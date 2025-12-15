import { system, world } from "@minecraft/server";

import "./DragonFlightSensor.ts";
import "./onSpawn.ts";
import "./onInteract.ts";


// This will print Hello world every 5 seconds
system.runInterval(() => {
    world.sendMessage("Hello, world!");
}, secondToTick(5));

// Convert second to tick, 1 tick in minecraft is 0.05 second. 20 ticks = 1 second
function secondToTick(second: number) {
    return second * 20
}