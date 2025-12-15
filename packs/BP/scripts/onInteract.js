import { world, system } from "@minecraft/server";
import { autoTameDrone } from "./onSpawn.js";
import { ActionFormData} from "@minecraft/server-ui";
import { dragonMeleeAttack } from "./meleeDamage.js";

function getDroneOwner(drone) {
    const tameable = drone.getComponent("minecraft:tameable");
    if (tameable && tameable.tamedToPlayerId) {
        const owner = world.getAllPlayers().find(player => player.id === tameable.tamedToPlayerId);
        return owner;
    }
    return null;
}

export function showDragonControl(player, dragon) {
    const dragonLocation = dragon.location;
    const owner = getDroneOwner(dragon);
    
    player.playSound("random.orb", { pitch: 1.0, volume: 1.0 });
    
    const form = new ActionFormData()
        .title("DRAGON COMMANDS")
        .body(`§fOwner: §e${owner?.name || "Unknown"}\n\n`)
        .button("ROAM\n§7Let dragon wander freely", "textures/ui/village_hero_effect")
        .button("SIT\n§7Make dragon sit and stay", "textures/items/saddle")
        .button("FOLLOW\n§7Dragon will follow you", "textures/ui/creator_glyph")
        .button("§cCANCEL\n§7Close this menu", "textures/ui/cancel");

    form.show(player).then((response) => {
        if (response.canceled) {
            return;
        }

        // Handle button selection
        switch(response.selection) {
            case 0: // ROAM
                dragon.triggerEvent("re_dra:event_teen_roam");
                player.sendMessage("§aDragon is now roaming freely!");
                player.playSound("random.orb", { pitch: 1.2, volume: 1.0 });
                break;
            case 1: // SIT
                dragon.triggerEvent("re_dra:event_teen_sit");
                player.sendMessage("§eDragon is now sitting!");
                player.playSound("random.orb", { pitch: 1.0, volume: 1.0 });
                break;
            case 2: // FOLLOW
                dragon.triggerEvent("re_dra:event_teen_follow");
                player.sendMessage("§bDragon will now follow you!");
                player.playSound("random.orb", { pitch: 1.4, volume: 1.0 });
                break;
            case 3: // CANCEL
                break;
        }
    });
}

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target } = event;
    
    // ========================================
    // ADULT DRAGON INTERACTION (while riding)
    // ========================================
    if (target.typeId === "re_dra:dragon") {
        // Check if player is riding this specific dragon
        const ridingComponent = player.getComponent("minecraft:riding");
        
        if (ridingComponent) {
            const riddenEntity = ridingComponent.entityRidingOn;
            
            // Check if the player is riding the dragon they're interacting with
            if (riddenEntity && riddenEntity.id === target.id) {
                // Player is riding this dragon and interacted with it
                // Trigger melee attack event
                target.triggerEvent("re_dra:event_melee_attack");
                
                // Execute melee attack damage
                dragonMeleeAttack(target, player);
                
                console.log(`[Dragon Melee] Player ${player.name} triggered melee attack on dragon ${target.id}`);
                player.playSound("random.orb", { pitch: 1.5, volume: 1.0 });
                
                return; // Exit early after handling
            }
        }
        
        // If not riding, allow normal interaction (future implementation)
        return;
    }
    
    // ========================================
    // BABY DRAGON INTERACTION
    // ========================================
    // Check if the interacted entity is a baby dragon
    if (target.typeId !== "re_dra:dragon_baby") return;
    
    // List of items that should cancel the interaction (feeding items)
    const feedingItems = [
        "minecraft:beef",
        "minecraft:chicken",
        "minecraft:rabbit",
        "minecraft:porkchop",
        "minecraft:cod",
        "minecraft:salmon",
        "minecraft:mutton"
    ];
    
    // Get the item the player is holding in their mainhand
    const equippable = player.getComponent("minecraft:equippable");
    const heldItem = equippable?.getEquipment("Mainhand");
    
    // Cancel interaction if player is holding a feeding item
    if (heldItem && feedingItems.includes(heldItem.typeId)) {
        return; // Exit early, allow vanilla feeding behavior
    }
    
    // Auto-tame the dragon if not already tamed
    const isTamed = autoTameDrone(target, player);
    
    if (isTamed) {
        // Get the owner of the dragon
        const owner = getDroneOwner(target);
        
        if (!owner) {
            player.sendMessage("§cUnable to identify dragon owner!");
            return;
        }

        
        // Check if the player is the owner
        if (owner.id !== player.id) {
            player.sendMessage("§cThis dragon belongs to another player!");
            player.playSound("random.orb", { pitch: 0.8, volume: 1.0 });
            return;
        }
        
        // Show control UI if not sneaking
        if (!player.isSneaking) {
            // Check dragon's variant before showing control menu
            const variantComponent = target.getComponent("minecraft:variant");
            
            if (variantComponent && variantComponent.value === 1) {
                showDragonControl(player, target);
            } else {
            }
        }
    } else {
        player.sendMessage("§cFailed to establish connection with dragon!");
        player.playSound("random.orb", { pitch: 0.8, volume: 1.0 });
    }
});

// ========================================
// ENTITY HIT ENTITY EVENT (Ranged Attack while riding)
// ========================================
world.afterEvents.entityHitEntity.subscribe((event) => {
    const { damagingEntity, hitEntity } = event;
    
    // Check if the damaging entity is a player
    if (damagingEntity.typeId !== "minecraft:player") return;
    
    // Check if the hit entity is an adult dragon
    if (hitEntity.typeId !== "re_dra:dragon") return;
    
    const player = damagingEntity;
    const dragon = hitEntity;
    
    // Check if player is riding this specific dragon
    const ridingComponent = player.getComponent("minecraft:riding");
    
    if (ridingComponent) {
        const riddenEntity = ridingComponent.entityRidingOn;
        
        // Check if the player is riding the dragon they just hit
        if (riddenEntity && riddenEntity.id === dragon.id) {
            // Player is riding this dragon and hit it
            // Trigger ranged attack event
            dragon.triggerEvent("re_dra:event_range_attack");
            
            console.log(`[Dragon Ranged] Player ${player.name} triggered ranged attack on dragon ${dragon.id}`);
            player.sendMessage("§b🏹 Dragon Ranged Attack!");
            player.playSound("random.orb", { pitch: 1.8, volume: 1.0 });
        }
    }
});