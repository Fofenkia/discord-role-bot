
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const fs = require("fs");

// CONFIGURATION
const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_ROLE_NAME = "+";
const CHANNEL_PREFIX = "rp-registration";
const CATEGORY_ID = null; // Optional: registration category ID

const RANKS = {
  "Mareşal": "Mrş.",
  "Orgeneral": "Org.",
  "Korgeneral": "Korg.",
  "Tümgeneral": "Tümg.",
  "Tuğgeneral": "Tuğg.",
  "Albay": "Alb.",
  "Yarbay": "Yrb.",
  "Binbaşı": "Bnb.",
  "Yüzbaşı": "Yzb.",
  "Üsteğmen": "Ütğm.",
  "Teğmen": "Tğm.",
  "Asteğmen": "Astğm.",
  "Uzman": "Uz.",
  "Kıdemli": "Kd.",
  "Astsubay": "Asb.",
  "Başçavuş": "Bçvş.",
  "Üstçavuş": "Üçvş.",
  "Çavuş": "Çvş.",
  "Onbaşı": "Onb.",
  "Er": "Er"
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Persistent RP name storage
const DATA_FILE = "./rp_names.json";

let rpNames = {};

if (fs.existsSync(DATA_FILE)) {
  rpNames = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveNames() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(rpNames, null, 2));
}

// Generate nickname based on current Discord roles
function generateNickname(member, rpName) {
  const rankRoles = member.roles.cache
    .filter(role => RANKS[role.name])
    .sort((a, b) => b.position - a.position);

  const abbreviations = rankRoles.map(
    role => RANKS[role.name]
  );

  return [...abbreviations, rpName].join(" ");
}

// Apply nickname
async function updateNickname(member) {
  const rpName = rpNames[member.id];

  if (!rpName) return;

  const nickname = generateNickname(member, rpName);

  if (nickname.length > 32) {
    console.log(`Nickname too long for ${member.user.tag}`);
    return;
  }

  try {
    await member.setNickname(nickname, "Automatic RP nickname system");
  } catch (error) {
    console.error("Nickname update failed:", error);
  }
}

// Create private registration channel
async function createRegistration(member) {
  const guild = member.guild;

  const adminRole = guild.roles.cache.find(
    role => role.name === ADMIN_ROLE_NAME
  );

  if (!adminRole) {
    console.error("Admin role not found!");
    return;
  }

  const channel = await guild.channels.create({
    name: `${CHANNEL_PREFIX}-${member.user.username}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 90),

    type: ChannelType.GuildText,
    parent: CATEGORY_ID || undefined,

    topic: `rp-registration:${member.id}`,

    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: member.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: adminRole.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      },
      {
        id: client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels
        ]
      }
    ]
  });

  await channel.send(
    `<@${member.id}> Welcome!\n\n` +
    `What should your roleplay name be?\n` +
    `Please enter your name with exactly **1 or 2 spaces**.\n\n` +
    `Example: Ahmet Yılmaz`
  );
}

// New member joins
client.on("guildMemberAdd", async member => {
  if (rpNames[member.id]) {
    await updateNickname(member);
    return;
  }

  await createRegistration(member);
});

// Process registration messages
client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  const channel = message.channel;

  if (!channel.topic?.startsWith("rp-registration:")) return;

  const targetId = channel.topic.split(":")[1];

  if (message.author.id !== targetId) return;

  const name = message.content.trim();

  const spaces = (name.match(/ /g) || []).length;

  if (
    (spaces !== 1 && spaces !== 2) ||
    name.startsWith(" ") ||
    name.endsWith(" ") ||
    name.includes("  ")
  ) {
    await message.reply(
      "Invalid name! Please use exactly 1 or 2 spaces."
    );
    return;
  }

  const member = await message.guild.members.fetch(targetId);

  const nickname = generateNickname(member, name);

  if (nickname.length > 32) {
    await message.reply(
      "Your generated nickname is too long for Discord. Please choose a shorter RP name."
    );
    return;
  }

  rpNames[targetId] = name;
  saveNames();

  try {
    await member.setNickname(
      nickname,
      "Initial RP registration"
    );

    await message.reply(
      `Registration successful! Your nickname is now **${nickname}**.\n` +
      "This channel will now be deleted."
    );

    setTimeout(async () => {
      await channel.delete().catch(console.error);
    }, 3000);

  } catch (error) {
    console.error(error);
    await message.reply(
      "I couldn't change your nickname. Please contact an administrator."
    );
  }
});

// Automatically update nicknames after role changes
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (!rpNames[newMember.id]) return;

  const oldRoles = oldMember.roles.cache.map(role => role.id).sort();
  const newRoles = newMember.roles.cache.map(role => role.id).sort();

  if (JSON.stringify(oldRoles) === JSON.stringify(newRoles)) return;

  await updateNickname(newMember);
});

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;
  if (message.content.trim() !== "!syncnames") return;

  const adminRole = message.guild.roles.cache.find(
    role => role.name === "+"
  );

  const isOwner = message.guild.ownerId === message.author.id;

const hasAdminRole = adminRole &&
  message.member.roles.cache.has(adminRole.id);

if (!isOwner && !hasAdminRole) {
  return message.reply("You don't have permission to use this command.");
}

  await message.reply("Starting member synchronization...");

  const members = await message.guild.members.fetch();

  let updated = 0;
  let registrations = 0;
  let skipped = 0;

  for (const member of members.values()) {
    if (member.user.bot) {
      skipped++;
      continue;
    }

    if (rpNames[member.id]) {
      await updateNickname(member);
      updated++;
    } else {
      const existingChannel = message.guild.channels.cache.find(
        channel =>
          channel.topic === `rp-registration:${member.id}`
      );

      if (!existingChannel) {
        await createRegistration(member);
        registrations++;
      } else {
        skipped++;
      }
    }
  }

  await message.reply(
    `Synchronization complete!\n` +
    `Nicknames updated: ${updated}\n` +
    `Registration channels created: ${registrations}\n` +
    `Skipped: ${skipped}`
  );
});

client.once("ready", () => {
  console.log(`${client.user.tag} is online!`);
});

client.login(TOKEN);
