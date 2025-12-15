import { ButtonState, EntityMovementComponent, EntityProjectileComponent, InputButton, InputPermissionCategory, TicksPerSecond } from "@minecraft/server";
import Music from "Game/Music";
import DefaultDragon from "MobComponents/MobComponents/Dragons/DefaultDragon";
import V3 from "Wrappers/V3";
import DragonSystem from "./DragonSystem";
class DragonFlightSystem extends DragonSystem {
    get stamina() {
        return this.comp.getPersistentProperty("Stamina");
    }
    set stamina(value) {
        this.comp.setPersistentProperty("Stamina", value);
    }
    init() {
        this.music = new Music();
        if (this.getRider() && !this.onGroundTime) {
            this.comp.setProp("is_flying", true);
            this.comp.setProp("flight_state", "flying");
            this.isBeingRidden = true;
        } else {
            this.comp.setProp("is_flying", false);
            this.comp.setProp("flight_state", "grounded");
        }
        this.comp.setProp("is_ranged_attacking", false);
        if (this.comp.tameSystem.isTamed()) {
            this.comp.rider = this.getRider();
            // Wait for the entity to be fully loaded on world load
            this.comp.timeout(()=>{
                this.comp.rider = this.getRider();
            }, 20);
        }
        if (this.comp.rider) this.flyingTime = 1;
        this.comp.onWorldEvent("WorldAfterEvents", "dataDrivenEntityTrigger", (eventData)=>{
            if (eventData.eventId !== "gm1_zen:on_hit") return;
            if (eventData.entity.id !== this.comp.entity.id) return;
            if (!this.comp.entity.valid()) return;
            this.attack();
        });
    }
    attack() {
        if (this.comp.timeSince(this.lastAttackTime) < (this.comp.milestone.projectileAttackCooldown ?? 0)) return;
        this.comp.setProp("is_ranged_attacking", true);
        this.comp.timeout(()=>{
            this.comp.setProp("is_ranged_attacking", false);
        }, 5);
        if (this.comp.MultipleProjectilesData) {
            for(let i = 0; i < this.comp.MultipleProjectilesData.shotCount; i++){
                const delay = this.comp.MultipleProjectilesData.intervalBetweenShots * i;
                this.comp.timeout(()=>{
                    this.shootProjectile();
                }, delay);
            }
        } else {
            this.shootProjectile();
        }
        this.lastAttackTime = Main.currentTick;
    }
    shootProjectile() {
        const rider = this.comp.rider;
        if (rider == undefined) return;
        const headLocation = new V3(rider.getHeadLocation());
        const viewDir = new V3(rider.getViewDirection());
        const spawnLocation = headLocation.addY(this.comp.ProjectileSpawnLocationVerticalOffset + 1.75).addV3(viewDir.setY(0).normalize().multiply(2));
        const shootDirection = this.getProjectileDirection(headLocation, viewDir, spawnLocation).addY(this.comp.ProjectileSpawnVerticalAngleOffset).normalize();
        // Clipboard.drawLine(headLocation, headLocation.addV3(viewDir.multiply(40)), 1);
        // Clipboard.drawLine(spawnLocation, spawnLocation.addV3(shootDirection.multiply(40)), 1);
        let projectile = undefined;
        try {
            projectile = EntityUtil.spawnEntity(this.comp.ProjectileId, spawnLocation, this.comp.entityF.dimension);
        } catch  {
            return;
        }
        const projComp = projectile.getComponent(EntityProjectileComponent.componentId);
        EntityStore.setOwner(projectile, this.comp.entityF);
        EntityStore.set(projectile, "InitialDirection", shootDirection);
        projComp.shoot(viewDir, {
            uncertainty: this.comp.ProjectileScatter
        });
    }
    getProjectileDirection(cameraLocation, cameraViewDirection, shootLocation) {
        const dimension = this.comp.entityF.dimension;
        const blockRc = dimension.getBlockFromRay(cameraLocation, cameraViewDirection, {
            maxDistance: 46
        });
        const entityRc = dimension.getEntitiesFromRay(cameraLocation, cameraViewDirection, {
            maxDistance: 46
        }).filter((e)=>e.distance > 10);
        let nearestTargetLocation = null;
        let nearestTargetDistance = null;
        // Get the nearest entity in the raycast
        if (entityRc.length > 0) {
            // console.warn("Entity hit: ", entityRc[0].entity.typeId);
            const hit = entityRc[0];
            const entityFeet = new V3(hit.entity.location);
            const C = cameraViewDirection.dot(entityFeet.subtractV3(cameraLocation).normalize());
            const a = entityFeet.subtractV3(cameraLocation).length();
            const b = hit.distance;
            const c = Math.sqrt(a * a + b * b - 2 * a * b * C);
            nearestTargetLocation = entityFeet.add(0, c, 0);
            nearestTargetDistance = cameraLocation.subtractV3(nearestTargetLocation).length();
        }
        // Get the nearest block in the raycast
        if (blockRc) {
            // console.warn("Block hit: ", blockRc.block.typeId);
            const blockLocation = new V3(blockRc.block.location).addV3(blockRc.faceLocation);
            const blockDistance = cameraLocation.subtractV3(blockLocation).length();
            if (!nearestTargetDistance || blockDistance < nearestTargetDistance) {
                nearestTargetLocation = blockLocation;
                nearestTargetDistance = blockDistance;
            }
        }
        if (!nearestTargetLocation) return cameraViewDirection.addY(0.02).normalize();
        else {
            return nearestTargetLocation.subtractV3(shootLocation).normalize();
        }
    }
    tryEndFlight() {
        if (!this.flyingTime) return;
        this.endFlying();
        this.disable();
    }
    processTamedFlight() {
        if (this.comp.isCurrentTickNth(23)) {
            this.comp.rider = this.getRider();
        }
        this.flightTimeElapsed = this.comp.rider ? EntityStore.get(this.comp.rider, "flightTimeElapsed") : 0;
        if (Main.currentTick % TicksPerSecond && this.comp.rider) {
            this.musicSettingEnabled = EntityStore.get(this.comp.rider, "flightMusic");
        }
        if (!this.onGroundTime && this.comp.rider && this.musicSettingEnabled) {
            this.flightTimeElapsed++;
            EntityStore.set(this.comp.rider, "flightTimeElapsed", this.flightTimeElapsed);
            this.handleMusic();
        }
        if (!this.flyingTime && typeof this.comp.milestone.maxStamina == "number") {
            this.stamina = this.stamina + this.comp.StaminaExhaustion.groundedTick;
            this.stamina = MathUtil.clamp(this.stamina, 0, this.comp.milestone.maxStamina);
        }
        if (!this.comp.rider || !EntityUtil.isValid(this.comp.rider)) return this.tryEndFlight();
        const isRiding = this.comp.rider.getComponent("riding")?.entityRidingOn.id === this.comp.entityId;
        if (!isRiding) return this.tryEndFlight();
        this.jumpingTime = this.comp.rider.inputInfo.getButtonState(InputButton.Jump) == ButtonState.Pressed ? this.jumpingTime + 1 : 0;
        this.onGroundTime = this.comp.entityF.isOnGround ? this.onGroundTime + 1 : 0;
        this.isBoosting = false;
        if (this.flyingTime && this.onGroundTime > 2 && this.flyingTime > 10) this.endFlying();
        else if (!this.flyingTime && this.jumpingTime) this.startFlying();
        else if (this.flyingTime) this.continueFlying();
        this.flyingTime = this.flyingTime ? this.flyingTime + 1 : 0;
    }
    /**
     * Handles the logic for triggering music while flying.
     * Music can only be triggered if a minimum amount of flight time has elapsed, and no music is playing
     */ handleMusic() {
        const musicTriggerInterval = this.comp.milestone.MusicTriggerInterval ?? DefaultDragon.MusicTriggerInterval;
        const minFlightTimeElapsed = this.flightTimeElapsed > musicTriggerInterval;
        const canTriggerMusic = minFlightTimeElapsed && !this.onGroundTime;
        const chanceToTriggerMusic = this.comp.milestone.ChanceToTriggerMusic ?? DefaultDragon.ChanceToTriggerMusic;
        if (canTriggerMusic && this.comp.rider != undefined) {
            this.music?.setPlayer(this.comp.rider);
            if (Config.get("Debug: Music Logs")) console.log(`calling tryPlayingMusic for ${this.music.getPlayer().name}`);
            if (this.music.tryPlayingMusic(chanceToTriggerMusic)) {
                this.musicPlaying = true;
            }
            this.flightTimeElapsed = 0;
            EntityStore.set(this.comp.rider, "flightTimeElapsed", this.flightTimeElapsed);
        }
    }
    endFlying() {
        this.flyingTime = 0;
        if (this.comp.entity.valid()) {
            this.comp.setProp("is_flying", false);
            this.comp.setProp("is_boosting", false);
            this.comp.setProp("is_hovering", false);
            this.comp.setProp("flight_state", "grounded");
            this.comp.entityF.removeEffect("levitation");
            this.comp.entityF.removeEffect("slow_falling");
            this.comp.entityF.triggerEvent("gm1_zen:riderable.add");
        }
        this.toggleRiderMovementControls(true);
        if (this.comp.rider?.valid()) {
            const speedComp = this.comp.rider.getComponent(EntityMovementComponent.componentId);
            speedComp?.resetToDefaultValue();
        }
    }
    continueFlying() {
        const hasStamina = this.stamina == "infinite" || this.stamina > 0;
        const isBoosting = !!this.jumpingTime && hasStamina && !this.hoveringTime;
        //The following determines the initial direction in which impulse should be applied
        const viewDirection = new V3(this.comp.rider.getViewDirection()).addY(0.2).normalize();
        const rightDirection = new V3(viewDirection.z, 0, -viewDirection.x);
        const movementVector = this.comp.rider.inputInfo.getMovementVector();
        const transformedMovement = rightDirection.multiply(movementVector.x).addV3(viewDirection.multiply(movementVector.y)).normalize();
        const speedShouldBe = this.velocity.addV3(transformedMovement.multiply(0.1)).multiply(0.9).length();
        this.velocity = this.velocity.addV3(transformedMovement.multiply(1 - this.comp.Momentum)).multiply(0.9).normalize().multiply(speedShouldBe);
        if (!hasStamina) {
            this.velocity = this.velocity.setY(Math.min(this.velocity.y, -0.5));
        }
        this.velocity = this.velocity.multiply(1 + movementVector.y * 0.07);
        const speed = this.velocity.length();
        //Determines if max speed should be boosting max speed or regular max speed
        let maxSpeed = isBoosting ? this.comp.BoostMaxSpeed * this.comp.milestone.boostMaxSpeedMultiplier : this.comp.MaxSpeed * this.comp.milestone.maxSpeedMultiplier;
        if (!hasStamina) maxSpeed *= this.comp.NoStaminaMaxSpeedMultiplier;
        const isAccelerating = movementVector.y > 0.9;
        //This if-else block applies acceleration/deceleration to flight
        if (speed < maxSpeed && isAccelerating) {
            let changeInViewDirectionRaw = 0;
            const viewDirs = this.directionBuffer.getSlice(4);
            for(let i = 0; i < viewDirs.length - 1; i++){
                const dotP = viewDirs[i].dot(viewDirs[i + 1]);
                changeInViewDirectionRaw += dotP;
            }
            const changeInDirection = MathUtil.clamp((1 - changeInViewDirectionRaw / (viewDirs.length - 1)) * this.comp.DecelerationFromMomentumChangeMultipler, 0, 1);
            if (speed > this.comp.DecelerationFromMomentumChangeMinSpeed) this.velocity = this.velocity.multiply(1 - changeInDirection);
            let acceleration = this.comp.Acceleration({
                directionChangePct: changeInDirection,
                isBoosting
            });
            acceleration *= this.comp.milestone.accelerationMultiplier;
            const pctToReachMaxSpeed = MathUtil.clamp((maxSpeed - speed) / maxSpeed, 0, 1) - 0.017;
            if (pctToReachMaxSpeed < acceleration) acceleration = pctToReachMaxSpeed;
            this.velocity = this.velocity.addV3(viewDirection.multiply(acceleration));
        } else if (speed > maxSpeed) {
            const differencePct = MathUtil.clamp((speed - maxSpeed) / maxSpeed, 0, 1) + 0.017;
            const decelerationSpeed = this.comp.DecelerationFromExceedingMaxSpeed;
            if (differencePct > decelerationSpeed) {
                this.velocity = this.velocity.multiply(1 - differencePct);
            } else {
                this.velocity = this.velocity.multiply(decelerationSpeed);
            }
        }
        //This applies stamina drain depending on flight state
        if (typeof this.comp.milestone.maxStamina == "number") {
            if (this.stamina == "infinite") this.stamina = this.comp.milestone.maxStamina;
            if (!this.hoveringTime) this.stamina += this.comp.StaminaExhaustion.flightTick;
            if (isBoosting) this.stamina += this.comp.StaminaExhaustion.boostingTick;
            if (this.hoveringTime) this.stamina += this.comp.StaminaExhaustion.hoveringTick;
            this.stamina = MathUtil.clamp(this.stamina, 0, this.comp.milestone.maxStamina);
        } else {
            this.stamina = "infinite";
        }
        if (this.comp.isCurrentTickNth(3)) this.directionBuffer.push(viewDirection);
        const velocityToApply = this.velocity;
        const isHovering = transformedMovement.length() < 0.1;
        if (!isHovering) {
            if (this.hoveringTime) this.endHovering();
            this.comp.entityF.clearVelocity();
            this.comp.entityF.applyImpulse(velocityToApply);
        } else {
            this.hover();
        }
        this.handleFov(isHovering, hasStamina, isBoosting);
        const isDiving = viewDirection.y < -0.5; //-0.5 equals -45degrees from horizontal
        if (isDiving) {
            this.dive(isBoosting);
        }
        //remember to change magic number! If you see this in the PR please request a change because I forgot! -Eliote
        if (this.stamina == "infinite") this.comp.log("Stamina: Infinite");
        else this.comp.log(`Stamina: ${this.stamina.toFixed(2)} | Max: ${this.comp.milestone.maxStamina.toFixed(2)}`);
        this.comp.setProp("is_boosting", isBoosting);
        this.comp.setProp("is_hovering", isHovering);
        this.comp.setProp("flight_state", isHovering ? "hovering" : "flying");
        this.isBoosting = isBoosting;
    }
    /**
     * Changes player's FOV based on their current inputs and dragon flight state. Once a dragon is out of stamina or the player is hover, FOV reduces to minFOV.
     * If the player is holding forward input, fov goes to maxSpeed fov, and if boosting, goes to max boosting FOV.
     * @param isHovering whether or not a dragon is hovering
     * @param hasStamina whether or not a dragon has stamina
     * @param isBoosting whether or not the player is currently boosting
     * @returns
     */ handleFov(isHovering, hasStamina, isBoosting) {
        const speedComp = this.comp.rider?.getComponent(EntityMovementComponent.componentId); //this is what sets player FOV
        const movementVector = this.comp.rider.inputInfo.getMovementVector(); //player input data
        const forwardInput = movementVector.y > 0.7;
        const backwardInput = movementVector.y < -0.3;
        const sideInput = movementVector.x > 0.7 || movementVector.x < -0.7;
        const slowFlyStates = isHovering || !hasStamina || backwardInput;
        const forwardRawInputData = movementVector.y; //raw input data, ranges from -1 to 1.
        let forwardFov = this.comp.MaxCruiseFov;
        if (isBoosting) {
            forwardFov = this.comp.MaxBoostFov;
        }
        const maxSideInputFovMultiplier = 0.7; //limits the FOV multiplier to this number if there's only side input. this had to be implemented for smooth transition between forward and side FOV
        if (!this.comp.DisableSideFov) {
            if (sideInput && !backwardInput || sideInput && forwardInput) {
                let sideFov = forwardFov * maxSideInputFovMultiplier;
                if (forwardInput) {
                    sideFov = forwardFov * forwardRawInputData;
                }
                if (this.fov < sideFov) {
                    this.fov += this.comp.FovChangeRate;
                } else if (this.fov - sideFov >= this.comp.FovChangeRate) {
                    this.fov -= this.comp.FovChangeRate;
                }
                speedComp.setCurrentValue(this.fov);
                return;
            }
        }
        if (slowFlyStates) {
            if (this.fov > this.comp.MinFov) this.fov -= this.comp.FovChangeRate;
        } else if (forwardInput) {
            if (this.fov < forwardFov) {
                this.fov += this.comp.FovChangeRate;
            } else if (this.fov - forwardFov >= this.comp.FovChangeRate) {
                this.fov -= this.comp.FovChangeRate;
            }
        } else {
            if (this.fov - this.comp.MinFov > -this.comp.FovChangeRate) this.fov -= this.comp.FovChangeRate;
        }
        speedComp.setCurrentValue(this.fov);
    }
    dive(isBoosting) {
        const viewDirection = new V3(this.comp.rider.getViewDirection()).addY(0.2).normalize();
        const minDiveSpeed = this.comp.MaxSpeed;
        const maxDiveSpeed = this.comp.BoostMaxSpeed * 2;
        const lookAngleSpeedMultiplier = Math.abs(viewDirection.y) + minDiveSpeed / 2;
        let speedToApply = Math.min(Math.max(lookAngleSpeedMultiplier, minDiveSpeed), maxDiveSpeed);
        if (isBoosting) {
            speedToApply += this.comp.DiveBoost;
        }
        const rightDirection = new V3(viewDirection.z, 0, -viewDirection.x);
        const movementVector = this.comp.rider.inputInfo.getMovementVector();
        if (movementVector.y != 1) return;
        //taken from processFlight(), I don't fully 100% understand it!
        const transformedMovement = rightDirection.multiply(movementVector.x).addV3(viewDirection.multiply(movementVector.y)).normalize();
        this.velocity = this.velocity.addV3(transformedMovement).normalize().multiply(speedToApply);
        // const speed = this.velocity.length();
        // console.log(speed);
        this.comp.entityF.clearVelocity();
        this.comp.entityF.applyImpulse(this.velocity);
    // this.updateFov(speed);
    }
    hover() {
        this.hoveringTime++;
        if (this.hoveringTime == 1) this.startHovering();
        if (this.comp.isCurrentTickNth(20)) {
            this.comp.entityF.addEffect("levitation", 7, {
                amplifier: 5,
                showParticles: false
            });
        }
    }
    startHovering() {
        this.comp.entityF.addEffect("slow_falling", 10000000, {
            showParticles: false
        });
    }
    endHovering() {
        this.hoveringTime = 0;
        this.comp.entityF.removeEffect("slow_falling");
        this.comp.entityF.removeEffect("levitation");
    }
    startFlying() {
        this.flyingTime = 1;
        this.comp.setProp("is_flying", true);
        this.FlightStartTime = Main.currentTick;
        this.comp.entityF.triggerEvent("gm1_zen:riderable_flying.add");
        // system.runTimeout(() => {
        //     this.comp.entityF.triggerEvent("gm1_zen:riderable.remove");
        // }, 20);
        const viewDir = new V3(this.comp.rider.getViewDirection());
        this.comp.entityF.applyKnockback(viewDir.x, viewDir.z, 0.35, 0.65);
        this.comp.entityF.addEffect("slow_falling", 1000000, {
            showParticles: false
        });
        this.toggleRiderMovementControls(false);
        this.velocity = new V3(0, 2, 0);
    }
    toggleRiderMovementControls(toggle) {
        if (!this.comp.rider?.valid()) return;
        this.comp.rider.inputPermissions.setPermissionCategory(InputPermissionCategory.LateralMovement, toggle);
        this.comp.rider.inputPermissions.setPermissionCategory(InputPermissionCategory.Mount, toggle);
        this.comp.rider.inputPermissions.setPermissionCategory(InputPermissionCategory.Jump, toggle);
    }
    getRider() {
        const rideableComponent = this.comp.entityF.getComponent("rideable");
        if (!rideableComponent) return undefined;
        return rideableComponent.getRiders().find((rider)=>rider.typeId == "minecraft:player");
    }
    enable() {
        const player = this.getRider();
        if (player) return;
        this.comp.entityF.triggerEvent("gm1_zen:tamed_ai.remove");
        this.comp.entityF.triggerEvent("gm1_zen:riderable.add");
        this.comp.entityF.triggerEvent("gm1_zen:dragon_inventory.add");
        this.isBeingRidden = true;
        this.comp.wantsSystem.removeWant();
    }
    disable() {
        this.comp.entity.try()?.triggerEvent("gm1_zen:tamed_ai.add");
        this.comp.entity.try()?.triggerEvent("gm1_zen:riderable.remove");
        this.comp.entity.try()?.triggerEvent("gm1_zen:riderable_flying.remove");
        this.comp.entity.try()?.triggerEvent("gm1_zen:dragon_inventory.remove");
        this.comp.rider = undefined;
        this.isBeingRidden = false;
        if (this.musicPlaying) {
            this.stopMusic();
        }
    }
    stopMusic() {
        this.music.playCustomMusic(this.music.BOOKSOUNDS[1]);
        this.musicPlaying = false;
    }
    constructor(...args){
        super(...args);
        this.directionBuffer = new GenericBuffer(10, V3.zero.clone());
        this.flyingTime = 0;
        this.hoveringTime = 0;
        this.onGroundTime = 0;
        this.jumpingTime = 0;
        this.velocity = V3.zero.clone();
        this.lastAttackTime = 0;
        this.isBoosting = false;
        this.fov = 0.05;
        this.isBeingRidden = false;
        this.flightTimeElapsed = 0;
        this.tryPlayingMusicAgain = TicksPerSecond * 10;
        this.musicPlaying = false;
        this.musicSettingEnabled = true;
    }
}
export { DragonFlightSystem as default };
