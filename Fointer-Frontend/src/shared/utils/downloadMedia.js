import api from "../services/http/client";

const readError = async (error) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text());
      if (body?.message) return body.message;
    } catch {
      /* the error body was not JSON */
    }
  }
  if (typeof data?.message === "string" && data.message) return data.message;
  return "Could not download this file.";
};

export async function downloadWatermarkedMedia(url, kind = "image") {
  try {
    const response = await api.get("/media/download", {
      params: { url, kind },
      responseType: "blob",
      timeout: kind === "video" ? 120000 : 45000,
    });
    const type = String(response.headers?.["content-type"] || "");
    if (type.includes("application/json")) {
      const body = JSON.parse(await response.data.text());
      throw new Error(body.message || "Could not download this file.");
    }
    const blob = response.data;
    const extension = type.includes("video") || kind === "video" ? "mp4" : "jpg";
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `fointer-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    if (error?.message && !error?.response) throw error;
    throw new Error(await readError(error));
  }
}
