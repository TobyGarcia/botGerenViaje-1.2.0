export function isPrivateChat(context) {
  return (
    context.chat?.type === "private"
  );
}

export function isAuthorizedGroup(context) {
  return isGroupWithId(context, process.env.TELEGRAM_GROUP_ID);
}

function isGroupWithId(context, configuredGroupId) {

  const chatType = context.chat?.type;

  if (
    !configuredGroupId ||
    (chatType !== "group" &&
      chatType !== "supergroup")
  ) {
    return false;
  }

  return (
    String(context.chat?.id) ===
    String(configuredGroupId)
  );
}

export function logCommand(context, command) {
  console.log({
    command,
    chatId: context.chat?.id,
    chatType: context.chat?.type,
    authorizedGroup: isAuthorizedGroup(context),
    updateId: context.update?.update_id
  });
}

export function getPrivateBotLink(
  startParameter = "viaje"
) {
  const username =
    process.env.TELEGRAM_BOT_USERNAME
      ?.replace(/^@/, "");

  if (!username) {
    throw new Error(
      "TELEGRAM_BOT_USERNAME no está configurado."
    );
  }

  return (
    `https://t.me/${username}` +
    `?start=${startParameter}`
  );
}
