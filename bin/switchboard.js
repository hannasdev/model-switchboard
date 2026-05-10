#!/usr/bin/env node
import { runSwitchboardCli } from "../src/switchboard/cli.js";

process.exitCode = runSwitchboardCli();
