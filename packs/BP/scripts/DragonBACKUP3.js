import { world, system } from "@minecraft/server";

/**
 * Modular function to detect all players with the "dragonRider" tag
 * Can be reused in other scripts by importing this function
 * @returns {Player[]} Array of players with the "dragonRider" tag
 */
export function detectDragonRiders() {
    try {
        const dragonRiders = [];
        const allPlayers = world.getAllPlayers();
        
        for (const player of allPlayers) {
            if (player.hasTag("dragonRider")) {
                dragonRiders.push(player);
            }
        }
        
        return dragonRiders;
    } catch (error) {
        //console.warn("Error detecting dragon riders:", error);
        return [];
    }
}

/**
 * Check if a block is solid/not passable
 * @param {Block} block - The block to check
 * @returns {boolean} True if block is solid, false otherwise
 */
export function isSolidBlock(block) {
    if (!block) return false;
    
    // List of non-solid/passable blocks that players can pass through
    const nonSolidBlocks = [
        "minecraft:air",
        "minecraft:water",
        "minecraft:flowing_water",
        "minecraft:lava",
        "minecraft:flowing_lava",
        "minecraft:barrier",
        "minecraft:light_block",
        "minecraft:light_block_0",
        "minecraft:light_block_1",
        "minecraft:light_block_2",
        "minecraft:light_block_3",
        "minecraft:light_block_4",
        "minecraft:light_block_5",
        "minecraft:light_block_6",
        "minecraft:light_block_7",
        "minecraft:light_block_8",
        "minecraft:light_block_9",
        "minecraft:light_block_10",
        "minecraft:light_block_11",
        "minecraft:light_block_12",
        "minecraft:light_block_13",
        "minecraft:light_block_14",
        "minecraft:light_block_15",
        "minecraft:tall_grass",
        "minecraft:short_grass",
        "minecraft:fern",
        "minecraft:large_fern",
        "minecraft:seagrass",
        "minecraft:kelp",
        "minecraft:torch",
        "minecraft:soul_torch",
        "minecraft:redstone_torch",
        "minecraft:fire",
        "minecraft:soul_fire",
        "minecraft:snow",
        "minecraft:rail",
        "minecraft:golden_rail",
        "minecraft:detector_rail",
        "minecraft:activator_rail",
        "minecraft:powered_rail",
        "minecraft:lever",
        "minecraft:redstone_wire",
        "minecraft:tripwire",
        "minecraft:tripwire_hook",
        "minecraft:stone_pressure_plate",
        "minecraft:wooden_pressure_plate",
        "minecraft:light_weighted_pressure_plate",
        "minecraft:heavy_weighted_pressure_plate",
        "minecraft:crimson_pressure_plate",
        "minecraft:warped_pressure_plate",
        "minecraft:acacia_pressure_plate",
        "minecraft:birch_pressure_plate",
        "minecraft:dark_oak_pressure_plate",
        "minecraft:jungle_pressure_plate",
        "minecraft:oak_pressure_plate",
        "minecraft:spruce_pressure_plate",
        "minecraft:mangrove_pressure_plate",
        "minecraft:bamboo_pressure_plate",
        "minecraft:cherry_pressure_plate",
    ];
    
    // If block is in non-solid list, it's not solid
    if (nonSolidBlocks.includes(block.typeId)) {
        return false;
    }
    
    // Everything else is considered solid (stone, dirt, gravel, etc.)
    return true;
}

/**
 * Check for solid blocks directly below the player
 * @param {Player} player - The player to check
 * @param {number} maxDistance - Maximum distance to check below (default: 4)
 * @returns {Object} Object with solidBlockFound boolean and block data
 */
export function checkSolidBlockBelow(player, maxDistance = 4) {
    try {
        const playerLocation = player.location;
        const dimension = player.dimension;
        
        // Check blocks directly below the player
        // Start from Y=0 (player's feet level) down to Y=-maxDistance
        for (let y = 0; y >= -maxDistance; y--) {
            const checkLocation = {
                x: Math.floor(playerLocation.x),
                y: Math.floor(playerLocation.y) + y,
                z: Math.floor(playerLocation.z)
            };
            
            try {
                const block = dimension.getBlock(checkLocation);
                //console.log(`  Checking Y=${checkLocation.y} (offset ${y}): ${block?.typeId} | isSolid: ${block ? isSolidBlock(block) : 'null'}`);
                
                if (block && isSolidBlock(block)) {
                    //console.log(`[${player.name}] ✓ Found solid block: ${block.typeId} at Y=${checkLocation.y} (${Math.abs(y)} blocks offset)`);
                    return {
                        hasSolidBlockBelow: true,
                        block: block,
                        location: checkLocation,
                        distance: Math.abs(y)
                    };
                }
            } catch (blockError) {
                // Block outside world bounds, skip
                //console.log(`  Checking Y=${checkLocation.y}: ERROR - ${blockError}`);
                continue;
            }
        }
        
        //console.log(`[${player.name}] ✗ No solid block found below (checked Y=${Math.floor(playerLocation.y)} to Y=${Math.floor(playerLocation.y) - maxDistance})`);
        return {
            hasSolidBlockBelow: false,
            block: null,
            location: null,
            distance: Infinity
        };
    } catch (error) {
        //console.warn("Error checking solid blocks below player:", error);
        return {
            hasSolidBlockBelow: false,
            block: null,
            location: null,
            distance: Infinity
        };
    }
}

/**
 * Storage for tracking player states (before/after conditions)
 * Key: player.name, Value: { hadSolidBlockBefore: boolean }
 */
const playerStates = new Map();

/**
 * Detect transitions in solid block presence below player
 * Tracks "before" and "after" conditions:
 * - BEFORE: No solid block below → Solid block appears below
 * - AFTER: Solid block below → No solid block below
 * 
 * @param {Player} player - The player to check
 * @returns {Object} Object with transition state and block info
 */
export function detectSolidBlockTransition(player) {
    try {
        const playerName = player.name;
        const playerLoc = player.location;
        
        // Get previous state (default to false if new player)
        const previousState = playerStates.get(playerName) || { hadSolidBlockBefore: false };
        const hadSolidBlockBefore = previousState.hadSolidBlockBefore;
        
        // Determine which detection range to use
        let currentBlockData;
        let detectionRange;
        
        if (hadSolidBlockBefore) {
            // Player was on ground - use shorter range (0-2 blocks) to detect takeoff
            detectionRange = 2;
            //console.log(`[${playerName}] Checking takeoff (0-${detectionRange} blocks)`);
            currentBlockData = checkSolidBlockBelow(player, detectionRange);
        } else {
            // Player was in air - use longer range (0-4 blocks) to detect landing
            detectionRange = 2;
            //console.log(`[${playerName}] Checking landing (0-${detectionRange} blocks)`);
            currentBlockData = checkSolidBlockBelow(player, detectionRange);
        }
        
        const hasSolidBlockNow = currentBlockData.hasSolidBlockBelow;
        
        //console.log(`[${playerName}] Y: ${playerLoc.y.toFixed(2)} | Has block below: ${hasSolidBlockNow} | Distance: ${currentBlockData.distance}`);
        
        // Determine transition type
        let transitionType = "none";
        
        if (!hadSolidBlockBefore && hasSolidBlockNow) {
            // BEFORE condition: No solid block → Solid block appeared (LANDING)
            transitionType = "before";
            //console.log(`[${playerName}] 🔵 BEFORE TRANSITION: Air → Ground (hadBefore: ${hadSolidBlockBefore}, hasNow: ${hasSolidBlockNow})`);
        } else if (hadSolidBlockBefore && !hasSolidBlockNow) {
            // AFTER condition: Solid block → No solid block (TAKEOFF)
            transitionType = "after";
            //console.log(`[${playerName}] 🟢 AFTER TRANSITION: Ground → Air (hadBefore: ${hadSolidBlockBefore}, hasNow: ${hasSolidBlockNow})`);
        }
        
        // Update player state
        playerStates.set(playerName, { hadSolidBlockBefore: hasSolidBlockNow });
        
        return {
            player: player,
            transitionType: transitionType,
            hasSolidBlockNow: hasSolidBlockNow,
            hadSolidBlockBefore: hadSolidBlockBefore,
            blockData: currentBlockData,
            detectionRange: detectionRange,
            // Helper flags for easy condition checking
            isBeforeCondition: transitionType === "before",
            isAfterCondition: transitionType === "after",
            isStable: transitionType === "none"
        };
    } catch (error) {
        //console.warn(`Error detecting solid block transition for player ${player.name}:`, error);
        return {
            player: player,
            transitionType: "error",
            hasSolidBlockNow: false,
            hadSolidBlockBefore: false,
            blockData: null,
            detectionRange: 0,
            isBeforeCondition: false,
            isAfterCondition: false,
            isStable: false
        };
    }
}

/**
 * Main function executed every 3 ticks
 * Detects dragon riders and checks for solid block transitions
 */
function dragonRiderTick() {
    try {
        // Get all players with "dragonRider" tag
        const dragonRiders = detectDragonRiders();
        
        if (dragonRiders.length === 0) {
            return; // No dragon riders to process
        }
        
        //console.log(`========== Dragon Rider Tick | ${dragonRiders.length} rider(s) ==========`);
        
        // Process each dragon rider
        for (const rider of dragonRiders) {
            // Detect solid block transitions for this rider
            const transitionData = detectSolidBlockTransition(rider);
            
            // Handle BEFORE condition: Landing on solid ground
            if (transitionData.isBeforeCondition) {
                // Player just landed on solid ground
                // Add your custom logic here
                // Example: Play landing sound, trigger event, etc.
                //console.log(`🛬 ${rider.name} landed on solid ground (BEFORE condition)`);
                //console.log(`   Block: ${transitionData.blockData.block?.typeId}`);
                //console.log(`   Distance: ${transitionData.blockData.distance} blocks`);
                
                // Optional: Send feedback to player
                rider.onScreenDisplay.setActionBar("§aLanded on ground");
            }
            
            // Handle AFTER condition: Taking off from solid ground
            if (transitionData.isAfterCondition) {
                // Player just left solid ground (flying/falling)
                // Add your custom logic here
                // Example: Play takeoff sound, trigger event, etc.
                //console.log(`🛫 ${rider.name} left solid ground (AFTER condition)`);
                //console.log(`   Was on block, now airborne`);
                
                // Optional: Send feedback to player
                rider.onScreenDisplay.setActionBar("§cLeft on ground");
            }
            
            // Optional: Log stable states for debugging
            if (transitionData.isStable) {
                // No transition, rider is stable (either on ground or in air)
                const state = transitionData.hasSolidBlockNow ? "on ground" : "airborne";
                //console.log(`   Stable state: ${state}`);
            }
            
            // Access detailed block data if needed
            if (transitionData.blockData && transitionData.blockData.hasSolidBlockBelow) {
                const blockBelow = transitionData.blockData.block;
                // Do something with the block below data
            }
        }
        
        //console.log(`====================================================`);
    } catch (error) {
        //console.warn("Error in dragonRiderTick:", error);
    }
}

/**
 * Initialize the Dragon rider system
 * Starts the 3-tick interval for detecting riders and solid blocks
 */
function initializeDragonSystem() {
    //console.log("Dragon rider system initialized - Running every 3 ticks");
    
    // Run the tick function every 3 ticks
    system.runInterval(() => {
        dragonRiderTick();
    }, 3);
}

// Auto-initialize when script loads
initializeDragonSystem();


