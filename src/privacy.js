export function isPrivateMode(value = process.env.PORTFOLIO_PRIVATE) {
  return value === "1";
}

export function shouldPersistConversation(privateMode) {
  return !privateMode;
}
