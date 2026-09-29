import { FEED_PATH } from "../constants/paths";

const PROFILE_SETUP_PATH = "/profile?setup=1";

export const getDashboardPathForRole = () => FEED_PATH;

/** After login/signup, send incomplete profiles to setup. */
export const getPostAuthPath = (authResponse) =>
  authResponse?.needsProfileSetup ? PROFILE_SETUP_PATH : FEED_PATH;
