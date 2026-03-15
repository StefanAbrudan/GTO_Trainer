const { execSync } = require("child_process");
const path = require("path");
process.chdir(__dirname);
process.env.PATH = "/usr/local/bin:" + process.env.PATH;
execSync(
  "/usr/local/bin/node node_modules/.bin/next dev --port 3000",
  { stdio: "inherit", cwd: __dirname, env: process.env }
);
