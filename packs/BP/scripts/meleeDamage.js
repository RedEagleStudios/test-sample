import { world, EntityDamageCause } from "@minecraft/server";

/**
 * Apply melee damage to entities in front of the dragon
 * Called when dragon performs melee attack while being ridden
 * @param {Entity} dragon - The dragon entity performing the attack
 * @param {Player} rider - The player riding the dragon (optional, for logging)
 * @returns {Object} Attack result with hit entities
 */
export function dragonMeleeAttack(dragon, rider = null) {
    try {
        console.log("========== DRAGON MELEE ATTACK START ==========");
        
        // Validate dragon entity
        if (!dragon || !dragon.isValid) {
            console.warn("[Melee Attack] Invalid dragon entity");
            return {
                success: false,
                hitCount: 0,
                hitEntities: []
            };
        }

        console.log(`[Melee Attack] Dragon ID: ${dragon.id}`);
        console.log(`[Melee Attack] Dragon Type: ${dragon.typeId}`);
        console.log(`[Melee Attack] Rider: ${rider ? rider.name : "None"}`);

        // Get dragon's view direction to determine "front"
        const viewDirection = dragon.getViewDirection();
        const dragonLocation = dragon.location;
        
        console.log(`[Melee Attack] Dragon Location: X=${dragonLocation.x.toFixed(2)}, Y=${dragonLocation.y.toFixed(2)}, Z=${dragonLocation.z.toFixed(2)}`);
        console.log(`[Melee Attack] View Direction: X=${viewDirection.x.toFixed(3)}, Y=${viewDirection.y.toFixed(3)}, Z=${viewDirection.z.toFixed(3)}`);
        
        // Calculate attack cone in front of dragon
        // Attack range: 5 blocks in front, 3 blocks wide
        const attackRange = 5;
        const attackWidth = 3;
        
        console.log(`[Melee Attack] Attack Range: ${attackRange} blocks`);
        console.log(`[Melee Attack] Scan Radius: ${attackRange + 2} blocks`);
        
        // Get all entities in the dimension
        const dimension = dragon.dimension;
        const nearbyEntities = dimension.getEntities({
            location: dragonLocation,
            maxDistance: attackRange + 2 // Slightly larger to ensure we catch entities
        });
        
        console.log(`[Melee Attack] Found ${nearbyEntities.length} nearby entities`);
        
        const hitEntities = [];
        let scannedCount = 0;
        let skippedCount = 0;
        
        // Filter entities that are in front of the dragon
        console.log("[Melee Attack] ─── Scanning Entities ───");
        
        for (const entity of nearbyEntities) {
            scannedCount++;
            
            // Skip invalid entities
            if (!entity || !entity.isValid) {
                console.log(`  [${scannedCount}] SKIP: Invalid entity`);
                skippedCount++;
                continue;
            }
            
            console.log(`  [${scannedCount}] Checking: ${entity.typeId} (ID: ${entity.id})`);
            
            // Skip the dragon itself
            if (entity.id === dragon.id) {
                console.log(`      └─ SKIP: Self (dragon itself)`);
                skippedCount++;
                continue;
            }
            
            // Skip the rider
            if (rider && entity.id === rider.id) {
                console.log(`      └─ SKIP: Rider (${rider.name})`);
                skippedCount++;
                continue;
            }
            
            // Skip other dragons to prevent friendly fire
            if (entity.typeId === "re_dra:dragon" || entity.typeId === "re_dra:dragon_baby") {
                console.log(`      └─ SKIP: Friendly dragon`);
                skippedCount++;
                continue;
            }
            
            // Calculate vector from dragon to target entity
            const targetLocation = entity.location;
            const toTarget = {
                x: targetLocation.x - dragonLocation.x,
                y: targetLocation.y - dragonLocation.y,
                z: targetLocation.z - dragonLocation.z
            };
            
            // Calculate distance
            const distance = Math.sqrt(
                toTarget.x * toTarget.x + 
                toTarget.y * toTarget.y + 
                toTarget.z * toTarget.z
            );
            
            console.log(`      └─ Distance: ${distance.toFixed(2)} blocks`);
            
            // Skip if too far
            if (distance > attackRange) {
                console.log(`         └─ SKIP: Too far (>${attackRange} blocks)`);
                skippedCount++;
                continue;
            }
            
            if (distance < 0.5) {
                console.log(`         └─ SKIP: Too close (<0.5 blocks)`);
                skippedCount++;
                continue;
            }
            
            // Normalize the toTarget vector
            const normalizedTarget = {
                x: toTarget.x / distance,
                y: toTarget.y / distance,
                z: toTarget.z / distance
            };
            
            // Calculate dot product with view direction (cosine of angle)
            // Ignore Y component for horizontal cone check
            const dotProduct = 
                (viewDirection.x * normalizedTarget.x) + 
                (viewDirection.z * normalizedTarget.z);
            
            const angleInDegrees = Math.acos(Math.max(-1, Math.min(1, dotProduct))) * (180 / Math.PI);
            console.log(`      └─ Dot Product: ${dotProduct.toFixed(3)} (Angle: ${angleInDegrees.toFixed(1)}°)`);
            
            // Check if entity is in front (dot product > 0.5 means angle < 60 degrees)
            // This creates a cone-shaped attack area
            const inFrontThreshold = 0.5; // ~60 degree cone
            
            if (dotProduct > inFrontThreshold) {
                console.log(`         └─ ✓ IN ATTACK CONE (threshold: ${inFrontThreshold}, cone: ~60°)`);
                // Entity is in the attack cone
                try {
                    console.log(`            └─ Applying 4 damage (entityAttack)...`);
                    
                    // Apply damage with entityAttack cause
                    const damageApplied = entity.applyDamage(4, {
                        cause: EntityDamageCause.entityAttack,
                        damagingEntity: dragon
                    });
                    
                    if (damageApplied) {
                        hitEntities.push({
                            entity: entity,
                            typeId: entity.typeId,
                            distance: distance.toFixed(2),
                            angle: angleInDegrees
                        });
                        
                        console.log(`               └─ ✅ DAMAGE APPLIED to ${entity.typeId}`);
                    } else {
                        console.log(`               └─ ⚠ Damage returned false for ${entity.typeId}`);
                    }
                } catch (damageError) {
                    console.warn(`               └─ ❌ DAMAGE FAILED: ${damageError}`);
                }
            } else {
                console.log(`         └─ SKIP: Outside attack cone (angle too wide: ${angleInDegrees.toFixed(1)}°)`);
                skippedCount++;
            }
        }
        
        console.log("[Melee Attack] ─── Scan Complete ───");
        console.log(`[Melee Attack] Total Scanned: ${scannedCount}`);
        console.log(`[Melee Attack] Skipped: ${skippedCount}`);
        console.log(`[Melee Attack] Hit: ${hitEntities.length}`);
        
        // Log attack summary
        if (hitEntities.length > 0) {
            console.log(`[Melee Attack] ✅ SUCCESS: Hit ${hitEntities.length} entit${hitEntities.length === 1 ? 'y' : 'ies'}`);
            
            // Detailed hit report
            hitEntities.forEach((hit, index) => {
                console.log(`   [${index + 1}] ${hit.typeId} - Distance: ${hit.distance}m, Angle: ${hit.angle.toFixed(1)}°`);
            });
            
            if (rider) {
                rider.sendMessage(`§c⚔ Melee Attack Hit: §f${hitEntities.length} target${hitEntities.length === 1 ? '' : 's'}!`);
            }
        } else {
            console.log(`[Melee Attack] ⚠ MISS: No targets hit`);
            if (rider) {
                rider.sendMessage("§7Melee attack missed...");
            }
        }
        
        console.log("========== DRAGON MELEE ATTACK END ==========\n");
        
        return {
            success: true,
            hitCount: hitEntities.length,
            hitEntities: hitEntities
        };
        
    } catch (error) {
        console.error("========== MELEE ATTACK ERROR ==========");
        console.error(`[Melee Attack] ❌ CRITICAL ERROR: ${error}`);
        console.error(`[Melee Attack] Error Stack:`, error.stack);
        console.error("========================================\n");
        
        return {
            success: false,
            hitCount: 0,
            hitEntities: [],
            error: error.message
        };
    }
}

/**
 * Alternative version: Simpler box-based attack area
 * Useful if cone calculation is too complex
 * @param {Entity} dragon - The dragon entity
 * @param {Player} rider - The player rider (optional)
 * @returns {Object} Attack result
 */
export function dragonMeleeAttackSimple(dragon, rider = null) {
    try {
        console.log("========== DRAGON MELEE ATTACK SIMPLE START ==========");
        
        if (!dragon || !dragon.isValid) {
            console.warn("[Melee Simple] Invalid dragon entity");
            return { success: false, hitCount: 0, hitEntities: [] };
        }

        console.log(`[Melee Simple] Dragon ID: ${dragon.id}`);
        
        const dragonLocation = dragon.location;
        const viewDirection = dragon.getViewDirection();
        
        console.log(`[Melee Simple] Dragon Location: X=${dragonLocation.x.toFixed(2)}, Y=${dragonLocation.y.toFixed(2)}, Z=${dragonLocation.z.toFixed(2)}`);
        console.log(`[Melee Simple] View Direction: X=${viewDirection.x.toFixed(3)}, Z=${viewDirection.z.toFixed(3)}`);
        
        // Calculate position in front of dragon
        const attackDistance = 3;
        const attackCenter = {
            x: dragonLocation.x + (viewDirection.x * attackDistance),
            y: dragonLocation.y + (viewDirection.y * attackDistance),
            z: dragonLocation.z + (viewDirection.z * attackDistance)
        };
        
        console.log(`[Melee Simple] Attack Center: X=${attackCenter.x.toFixed(2)}, Y=${attackCenter.y.toFixed(2)}, Z=${attackCenter.z.toFixed(2)}`);
        console.log(`[Melee Simple] Search Radius: 2 blocks from center`);
        
        // Get entities in box area in front
        const dimension = dragon.dimension;
        const targets = dimension.getEntities({
            location: attackCenter,
            maxDistance: 2 // 2 block radius from attack center
        });
        
        console.log(`[Melee Simple] Found ${targets.length} entities near attack center`);
        
        const hitEntities = [];
        let processedCount = 0;
        
        for (const entity of targets) {
            processedCount++;
            
            // Skip invalid, self, rider, and other dragons
            if (!entity || !entity.isValid) {
                console.log(`  [${processedCount}] SKIP: Invalid entity`);
                continue;
            }
            
            console.log(`  [${processedCount}] Checking: ${entity.typeId}`);
            
            if (entity.id === dragon.id) {
                console.log(`      └─ SKIP: Self`);
                continue;
            }
            
            if (rider && entity.id === rider.id) {
                console.log(`      └─ SKIP: Rider`);
                continue;
            }
            
            if (entity.typeId === "re_dra:dragon" || entity.typeId === "re_dra:dragon_baby") {
                console.log(`      └─ SKIP: Friendly dragon`);
                continue;
            }
            
            try {
                console.log(`      └─ Applying 4 damage...`);
                
                const damageApplied = entity.applyDamage(4, {
                    cause: EntityDamageCause.entityAttack,
                    damagingEntity: dragon
                });
                
                if (damageApplied) {
                    hitEntities.push({
                        entity: entity,
                        typeId: entity.typeId
                    });
                    console.log(`         └─ ✅ DAMAGE APPLIED to ${entity.typeId}`);
                } else {
                    console.log(`         └─ ⚠ Damage returned false`);
                }
            } catch (error) {
                console.warn(`         └─ ❌ DAMAGE FAILED: ${error}`);
            }
        }
        
        console.log(`[Melee Simple] Hit ${hitEntities.length} entities`);
        
        if (hitEntities.length > 0) {
            if (rider) {
                rider.sendMessage(`§c⚔ Melee Hit: §f${hitEntities.length} target${hitEntities.length === 1 ? '' : 's'}!`);
            }
            console.log("[Melee Simple] ✅ SUCCESS");
        } else {
            console.log("[Melee Simple] ⚠ MISS");
        }
        
        console.log("========== DRAGON MELEE ATTACK SIMPLE END ==========\n");
        
        return {
            success: true,
            hitCount: hitEntities.length,
            hitEntities: hitEntities
        };
        
    } catch (error) {
        console.error("========== MELEE SIMPLE ERROR ==========");
        console.error(`[Melee Simple] ❌ CRITICAL ERROR: ${error}`);
        console.error(`[Melee Simple] Error Stack:`, error.stack);
        console.error("========================================\n");
        
        return { success: false, hitCount: 0, hitEntities: [] };
    }
}
