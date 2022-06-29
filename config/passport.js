const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const config = require("./config");
const opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = config.jwt_secret;
module.exports = passport => {
  passport.use(
    new JwtStrategy(opts, (jwt_payload, done) => {
      db.executeQuery("SELECT * FROM users WHERE username = ?", [jwt_payload.username])
        .then(rows => {
          if (rows.length > 0) {
            return done(null, user);
          } else {
            return done(null, false);
          }
        })
        .catch(next);
    })
  );
};
