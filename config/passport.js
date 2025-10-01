const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const fetch = require("node-fetch");
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, GUILD_ID, TOKEN } = require("./env");
const { getConfig } = require("./config");

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
  new DiscordStrategy(
    {
      clientID: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      callbackURL: REDIRECT_URI,
      scope: ["identify", "guilds", "guilds.members.read"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Utiliser le token bot pour récupérer le membre de la guilde
        const response = await fetch(
          `https://discord.com/api/guilds/${GUILD_ID}/members/${profile.id}`,
          {
            headers: {
              Authorization: `Bot ${TOKEN}`,
            },
          }
        );

        if (!response.ok) {
          console.error("❌ Erreur récupération membre :", await response.text());
          return done(null, profile);
        }

        const guildMember = await response.json();
        profile.guild_member = guildMember;

        // Récupérer la config pour l'ID du rôle DOJ
        const config = await getConfig();
        const dojRoleId = config.doj_role_id ? String(config.doj_role_id) : null;

        profile.isDOJ = dojRoleId && guildMember.roles && guildMember.roles.includes(dojRoleId);

        return done(null, profile);
      } catch (err) {
        console.error("❌ Erreur stratégie Discord :", err);
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
