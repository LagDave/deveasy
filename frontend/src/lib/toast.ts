import hotToast from "react-hot-toast";

/**
 * Single toast surface. Errors are shown through here, not ad-hoc alert()/console
 * (Constitution §16.3).
 */
export const toast = {
  success: (msg: string) => hotToast.success(msg),
  error: (msg: string) => hotToast.error(msg),
  info: (msg: string) => hotToast(msg),
};
