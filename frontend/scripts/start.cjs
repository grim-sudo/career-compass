process.env.HOST ||= "localhost";

// ponytail: CRA 5 derives an undefined allowedHost for loopback binds; remove
// this compatibility override when replacing CRA, not by disabling host checks.
const configPath = require.resolve("react-scripts/config/webpackDevServer.config");
const createConfig = require(configPath);
require.cache[configPath].exports = (proxy) => createConfig(proxy, "localhost");

if (require.main === module) require("react-scripts/scripts/start");
