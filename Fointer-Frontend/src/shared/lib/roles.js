import { FEED_PATH } from "../constants/paths";

export const getDashboardPathForRole = () => FEED_PATH;

/** After login or signup, open the feed. Incomplete profiles get a separate prompt. */
export const getPostAuthPath = () => FEED_PATH;
