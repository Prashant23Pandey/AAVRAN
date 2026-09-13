import {
	BoxGeometry,
	CapsuleGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	SphereGeometry,
	Vector3
} from 'three';

export interface PlayerController {
	mesh: Group;
	position: Vector3;
	velocity: Vector3;
	isMoving: () => boolean;
	getSpeed: () => number;
	setPaused: (paused: boolean) => void;
	update: (delta: number, elapsed: number, getTerrainElevation: (x: number, z: number) => number) => void;
	resetPosition: (x?: number, z?: number) => void;
	dispose: () => void;
}

export function createPlayerController(
	camera: PerspectiveCamera,
	domElement: HTMLElement,
	initialX = -20,
	initialZ = 0
): PlayerController {
	const playerGroup = new Group();
	playerGroup.name = 'PlayerAvatar';

	const disposables: { dispose: () => void }[] = [];

	// 1. Visual Avatar: Stylized Emergency Trainee Figure
	// High-visibility orange rescue jacket, dark trousers, safety helmet
	const bodyGeo = new CapsuleGeometry(0.32, 0.7, 8, 16);
	const vestMat = new MeshStandardMaterial({
		color: '#ea580c', // Bright Emergency Safety Orange
		roughness: 0.5,
		metalness: 0.1
	});
	disposables.push(bodyGeo, vestMat);

	const bodyMesh = new Mesh(bodyGeo, vestMat);
	bodyMesh.position.y = 0.95;
	bodyMesh.castShadow = true;
	playerGroup.add(bodyMesh);

	// Reflective Safety Stripes on vest
	const stripeGeo = new CylinderGeometry(0.33, 0.33, 0.12, 16);
	const stripeMat = new MeshStandardMaterial({
		color: '#f8fafc',
		emissive: '#f8fafc',
		emissiveIntensity: 0.4,
		roughness: 0.2
	});
	disposables.push(stripeGeo, stripeMat);

	const stripeMesh = new Mesh(stripeGeo, stripeMat);
	stripeMesh.position.y = 0.95;
	playerGroup.add(stripeMesh);

	// Head & Helmet
	const headGeo = new SphereGeometry(0.24, 16, 16);
	const skinMat = new MeshStandardMaterial({ color: '#fcd34d', roughness: 0.6 });
	disposables.push(headGeo, skinMat);
	const headMesh = new Mesh(headGeo, skinMat);
	headMesh.position.y = 1.55;
	headMesh.castShadow = true;
	playerGroup.add(headMesh);

	// Safety Helmet
	const helmetGeo = new SphereGeometry(0.27, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
	const helmetMat = new MeshStandardMaterial({
		color: '#fbbf24', // Safety yellow helmet
		roughness: 0.3,
		metalness: 0.2
	});
	disposables.push(helmetGeo, helmetMat);
	const helmetMesh = new Mesh(helmetGeo, helmetMat);
	helmetMesh.position.y = 1.62;
	helmetMesh.castShadow = true;
	playerGroup.add(helmetMesh);

	// Directional Arrow Indicator in front of player
	const arrowGeo = new ConeGeometry(0.2, 0.5, 6);
	arrowGeo.rotateX(Math.PI / 2);
	const arrowMat = new MeshStandardMaterial({
		color: '#38bdf8',
		emissive: '#0284c7',
		emissiveIntensity: 0.6
	});
	disposables.push(arrowGeo, arrowMat);
	const arrowMesh = new Mesh(arrowGeo, arrowMat);
	arrowMesh.position.set(0, 0.15, 0.85);
	playerGroup.add(arrowMesh);

	// Initial coordinates
	playerGroup.position.set(initialX, 0, initialZ);

	// Input State
	const keys = {
		forward: false,
		backward: false,
		left: false,
		right: false,
		sprint: false
	};

	function onKeyDown(e: KeyboardEvent) {
		switch (e.code) {
			case 'KeyW':
			case 'ArrowUp':
				keys.forward = true;
				break;
			case 'KeyS':
			case 'ArrowDown':
				keys.backward = true;
				break;
			case 'KeyA':
			case 'ArrowLeft':
				keys.left = true;
				break;
			case 'KeyD':
			case 'ArrowRight':
				keys.right = true;
				break;
			case 'ShiftLeft':
			case 'ShiftRight':
				keys.sprint = true;
				break;
		}
	}

	function onKeyUp(e: KeyboardEvent) {
		switch (e.code) {
			case 'KeyW':
			case 'ArrowUp':
				keys.forward = false;
				break;
			case 'KeyS':
			case 'ArrowDown':
				keys.backward = false;
				break;
			case 'KeyA':
			case 'ArrowLeft':
				keys.left = false;
				break;
			case 'KeyD':
			case 'ArrowRight':
				keys.right = false;
				break;
			case 'ShiftLeft':
			case 'ShiftRight':
				keys.sprint = false;
				break;
		}
	}

	// Mouse Drag Orbit angle
	let isDragging = false;
	let lastMouseX = 0;
	let cameraYaw = 0; // Relative horizontal camera rotation
	let cameraPitch = 0.35; // Slight downward look

	function onMouseDown(e: MouseEvent) {
		if (e.button === 0) {
			isDragging = true;
			lastMouseX = e.clientX;
		}
	}

	function onMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		const deltaX = e.clientX - lastMouseX;
		lastMouseX = e.clientX;
		cameraYaw -= deltaX * 0.006;
	}

	function onMouseUp() {
		isDragging = false;
	}

	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);
	domElement.addEventListener('mousedown', onMouseDown);
	window.addEventListener('mousemove', onMouseMove);
	window.addEventListener('mouseup', onMouseUp);

	// Movement physics — tuned ~22% faster for brisk responsive emergency navigation
	const velocity = new Vector3();
	const targetDirection = new Vector3();
	const baseMoveSpeed = 9.0; // meters per second (~21.6% increase over 7.4)
	const acceleration = 34.0; // Snappy acceleration
	const damping = 14.0;

	// Camera Follow configuration
	const cameraDistance = 8.5;
	const cameraHeight = 4.8;
	const cameraTargetPos = new Vector3();
	const cameraLookAtPos = new Vector3();

	let isMovementPaused = false;

	function setPaused(paused: boolean) {
		isMovementPaused = paused;
		if (paused) {
			keys.forward = false;
			keys.backward = false;
			keys.left = false;
			keys.right = false;
			keys.sprint = false;
			velocity.set(0, 0, 0);
		}
	}

	function isMoving(): boolean {
		return !isMovementPaused && (targetDirection.lengthSq() > 0.001 || velocity.lengthSq() > 0.04);
	}

	function getSpeed(): number {
		return Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
	}

	function update(delta: number, elapsed: number, getTerrainElevation: (x: number, z: number) => number) {
		const dt = Math.min(delta, 0.1);

		// Compute input vector relative to camera viewing direction
		targetDirection.set(0, 0, 0);

		if (!isMovementPaused) {
			const forwardVector = new Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
			const rightVector = new Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

			if (keys.forward) targetDirection.add(forwardVector);
			if (keys.backward) targetDirection.sub(forwardVector);
			if (keys.right) targetDirection.add(rightVector);
			if (keys.left) targetDirection.sub(rightVector);
		}

		const moving = targetDirection.lengthSq() > 0.001;
		if (moving) {
			targetDirection.normalize();
			velocity.x += targetDirection.x * acceleration * dt;
			velocity.z += targetDirection.z * acceleration * dt;

			// Active speed cap: sprint grants ~30% extra speed if Shift is held
			const maxSpeed = keys.sprint ? baseMoveSpeed * 1.3 : baseMoveSpeed;
			const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
			if (currentSpeed > maxSpeed) {
				velocity.x = (velocity.x / currentSpeed) * maxSpeed;
				velocity.z = (velocity.z / currentSpeed) * maxSpeed;
			}

			// Face movement direction smoothly
			const targetAngle = Math.atan2(velocity.x, velocity.z);
			let angleDiff = targetAngle - playerGroup.rotation.y;
			while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
			while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
			playerGroup.rotation.y += angleDiff * Math.min(dt * 14, 1);

			// Walking / Sprinting bob animation
			const bobRate = keys.sprint ? 18 : 15;
			const bobAmp = keys.sprint ? 0.1 : 0.08;
			bodyMesh.position.y = 0.95 + Math.abs(Math.sin(elapsed * bobRate)) * bobAmp;
			headMesh.position.y = 1.55 + Math.abs(Math.sin(elapsed * bobRate)) * bobAmp;
			helmetMesh.position.y = 1.62 + Math.abs(Math.sin(elapsed * bobRate)) * bobAmp;
		} else {
			// Apply damping friction
			velocity.x -= velocity.x * damping * dt;
			velocity.z -= velocity.z * damping * dt;

			// Idle subtle breathing
			bodyMesh.position.y = 0.95 + Math.sin(elapsed * 2.5) * 0.02;
			headMesh.position.y = 1.55 + Math.sin(elapsed * 2.5) * 0.02;
			helmetMesh.position.y = 1.62 + Math.sin(elapsed * 2.5) * 0.02;
		}

		// Update position
		playerGroup.position.x += velocity.x * dt;
		playerGroup.position.z += velocity.z * dt;

		// Constrain to island bounds
		playerGroup.position.x = Math.max(-42, Math.min(42, playerGroup.position.x));
		playerGroup.position.z = Math.max(-42, Math.min(42, playerGroup.position.z));

		// Clamp elevation seamlessly to terrain
		const groundY = getTerrainElevation(playerGroup.position.x, playerGroup.position.z);
		playerGroup.position.y = groundY;

		// Pulsing arrow indicator
		arrowMat.emissiveIntensity = 0.4 + Math.sin(elapsed * 6) * 0.3;

		// Camera Smooth Third-Person Tracking
		const camOffsetX = Math.sin(cameraYaw) * cameraDistance;
		const camOffsetZ = Math.cos(cameraYaw) * cameraDistance;

		cameraTargetPos.set(
			playerGroup.position.x + camOffsetX,
			playerGroup.position.y + cameraHeight,
			playerGroup.position.z + camOffsetZ
		);

		camera.position.lerp(cameraTargetPos, Math.min(dt * 10.5, 1));

		cameraLookAtPos.set(
			playerGroup.position.x,
			playerGroup.position.y + 1.4,
			playerGroup.position.z
		);
		camera.lookAt(cameraLookAtPos);
	}

	function resetPosition(x = initialX, z = initialZ) {
		playerGroup.position.set(x, 0, z);
		velocity.set(0, 0, 0);
	}

	function dispose() {
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup', onKeyUp);
		domElement.removeEventListener('mousedown', onMouseDown);
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', onMouseUp);

		for (const d of disposables) {
			d.dispose();
		}
	}

	return {
		mesh: playerGroup,
		position: playerGroup.position,
		velocity,
		isMoving,
		getSpeed,
		setPaused,
		update,
		resetPosition,
		dispose
	};
}
