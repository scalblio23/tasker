export const PASSCODE_KEY = 'tasker.passcode';

const readPasscode = () => {
  try {
    return localStorage.getItem(PASSCODE_KEY) ?? '';
  } catch {
    return '';
  }
};

/** Where data lives this session — set by the store once it has talked to the server. */
export const syncConfig = {
  shared: false,
  /** How attachments upload to shared storage ('token' / 'presigned'), or false to keep them local. */
  files: false as false | 'token' | 'presigned',
  passcode: readPasscode(),
};
