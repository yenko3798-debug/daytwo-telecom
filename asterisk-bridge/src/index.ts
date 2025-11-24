import { startServer } from "./server.js";
import { logger } from "./logger.js";

startServer().catch((error) => {
  logger.fatal("Bridge server failed to start", { error: error?.message ?? error });
  process.exit(1);
});
