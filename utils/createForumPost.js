async function createForumPost(client, channelId, title, embed) {
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== 15) {
    throw new Error("Le canal n'est pas un forum channel !");
  }

  const thread = await channel.threads.create({
    name: title,
    message: {
      embeds: embed.embeds
    }
  });

  return thread;
}

module.exports = createForumPost;
