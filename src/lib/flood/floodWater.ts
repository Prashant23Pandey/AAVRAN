import {
	BoxGeometry,
	Color,
	CylinderGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	ShaderMaterial,
	Vector2,
	Vector3
} from 'three';

export interface FloatingDebris {
	mesh: Mesh;
	baseX: number;
	baseZ: number;
	offset: number;
	speed: number;
	rotationSpeed: number;
}

export interface FloodWaterSystem {
	mesh: Mesh;
	material: ShaderMaterial;
	debrisGroup: Group;
	debrisList: FloatingDebris[];
	getCurrentWaterLevel: () => number;
	setWaterLevel: (level: number) => void;
	update: (delta: number, elapsed: number) => void;
	dispose: () => void;
}

const waterVertexShader = /* glsl */ `
	uniform float uTime;
	uniform float uWaveHeight;
	varying vec3 vWorldPosition;
	varying vec2 vUv;
	varying vec3 vNormal;

	void main() {
		vUv = uv;
		vec3 pos = position;

		// Gentle organic undulation across two wave frequencies
		float wave1 = sin(pos.x * 0.18 + uTime * 1.6) * cos(pos.y * 0.14 + uTime * 1.2);
		float wave2 = sin(pos.x * 0.35 - uTime * 1.8) * sin(pos.y * 0.28 + uTime * 1.4) * 0.5;
		pos.z += (wave1 + wave2) * uWaveHeight;

		vec4 worldPos = modelMatrix * vec4(pos, 1.0);
		vWorldPosition = worldPos.xyz;
		vNormal = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
		gl_Position = projectionMatrix * viewMatrix * worldPos;
	}
`;

const waterFragmentShader = /* glsl */ `
	uniform vec3 uColorShallow;
	uniform vec3 uColorDeep;
	uniform vec3 uFoamColor;
	uniform float uTime;
	uniform vec3 uSunDirection;

	varying vec3 vWorldPosition;
	varying vec2 vUv;
	varying vec3 vNormal;

	void main() {
		// Moving ripple pattern
		float ripple = sin(vWorldPosition.x * 1.2 + uTime * 2.0) * cos(vWorldPosition.z * 1.2 + uTime * 1.8);
		float ripple2 = sin(vWorldPosition.x * 2.8 - uTime * 1.4) * sin(vWorldPosition.z * 2.5 + uTime * 2.2);
		float rippleMix = smoothstep(-0.8, 0.8, ripple + ripple2 * 0.4);

		// Mix murky urban floodwater tones (sediment-tinted river water)
		vec3 waterColor = mix(uColorDeep, uColorShallow, rippleMix);

		// Simple specular sun highlight on ripples
		vec3 viewDir = normalize(cameraPosition - vWorldPosition);
		vec3 halfVector = normalize(uSunDirection + viewDir);
		float spec = pow(max(dot(vec3(0.0, 1.0, 0.0), halfVector), 0.0), 32.0);

		// Subtle edge/crest foam
		float foam = smoothstep(0.72, 0.98, ripple + ripple2 * 0.5);
		vec3 finalColor = mix(waterColor, uFoamColor, foam * 0.45) + spec * 0.35;

		gl_FragColor = vec4(finalColor, 0.86);
	}
`;

export function createFloodWaterSystem(initialLevel = -0.6, boundsSize = 140): FloodWaterSystem {
	let currentWaterLevel = initialLevel;

	const geometry = new PlaneGeometry(boundsSize, boundsSize, 96, 96);
	geometry.rotateX(-Math.PI / 2);

	const sunDir = new Vector3(12, 18, 10).normalize();

	const material = new ShaderMaterial({
		vertexShader: waterVertexShader,
		fragmentShader: waterFragmentShader,
		transparent: true,
		depthWrite: false,
		side: DoubleSide,
		uniforms: {
			uTime: { value: 0 },
			uWaveHeight: { value: 0.16 },
			uColorShallow: { value: new Color('#3b8898') },
			uColorDeep: { value: new Color('#1c4a5c') },
			uFoamColor: { value: new Color('#d2e8ed') },
			uSunDirection: { value: sunDir }
		}
	});

	const mesh = new Mesh(geometry, material);
	mesh.position.y = currentWaterLevel;
	mesh.receiveShadow = true;

	// Floating debris (crates, barrels, emergency hazard buoys)
	const debrisGroup = new Group();
	debrisGroup.name = 'FloatingDebris';

	const debrisList: FloatingDebris[] = [];

	const crateGeo = new BoxGeometry(0.8, 0.8, 0.8);
	const barrelGeo = new CylinderGeometry(0.4, 0.4, 0.9, 12);
	const buoyGeo = new CylinderGeometry(0.1, 0.5, 1.1, 8);

	const woodMat = new MeshStandardMaterial({ color: '#8a6240', roughness: 0.85 });
	const barrelMat = new MeshStandardMaterial({ color: '#c05621', roughness: 0.5 });
	const buoyMat = new MeshStandardMaterial({ color: '#e53e3e', roughness: 0.4 });

	// Scatter debris around lower street & river basin zones
	const debrisPositions = [
		{ x: -14, z: -8, type: 'crate' },
		{ x: -10, z: -16, type: 'barrel' },
		{ x: -4, z: -10, type: 'crate' },
		{ x: -18, z: -2, type: 'buoy' },
		{ x: -8, z: 6, type: 'barrel' },
		{ x: -2, z: -18, type: 'crate' },
		{ x: 6, z: -14, type: 'barrel' },
		{ x: -22, z: -12, type: 'buoy' },
		{ x: -12, z: 12, type: 'crate' }
	];

	for (const [i, p] of debrisPositions.entries()) {
		let geo: import('three').BufferGeometry = crateGeo;
		let mat: MeshStandardMaterial = woodMat;
		if (p.type === 'barrel') {
			geo = barrelGeo;
			mat = barrelMat;
		} else if (p.type === 'buoy') {
			geo = buoyGeo;
			mat = buoyMat;
		}

		const debrisMesh = new Mesh(geo, mat);
		debrisMesh.castShadow = true;
		debrisMesh.receiveShadow = true;
		debrisMesh.position.set(p.x, currentWaterLevel, p.z);
		debrisGroup.add(debrisMesh);

		debrisList.push({
			mesh: debrisMesh,
			baseX: p.x,
			baseZ: p.z,
			offset: i * 0.9,
			speed: 1.2 + (i % 3) * 0.3,
			rotationSpeed: 0.3 + (i % 2) * 0.2
		});
	}

	function update(delta: number, elapsed: number) {
		material.uniforms.uTime.value = elapsed;
		mesh.position.y = currentWaterLevel;

		// Update floating debris with buoyancy and gentle wave rocking
		for (const item of debrisList) {
			const wave =
				Math.sin(item.baseX * 0.18 + elapsed * 1.6) *
				Math.cos(item.baseZ * 0.14 + elapsed * 1.2) *
				0.16;

			// Float on water surface with partial submersion
			item.mesh.position.y = currentWaterLevel + wave - 0.1;
			item.mesh.rotation.x = Math.sin(elapsed * item.speed + item.offset) * 0.15;
			item.mesh.rotation.z = Math.cos(elapsed * item.speed * 0.8 + item.offset) * 0.12;
			item.mesh.rotation.y += delta * item.rotationSpeed * 0.2;
		}
	}

	function setWaterLevel(level: number) {
		currentWaterLevel = level;
		mesh.position.y = level;
	}

	function getCurrentWaterLevel() {
		return currentWaterLevel;
	}

	function dispose() {
		geometry.dispose();
		material.dispose();
		crateGeo.dispose();
		barrelGeo.dispose();
		buoyGeo.dispose();
		woodMat.dispose();
		barrelMat.dispose();
		buoyMat.dispose();
	}

	return {
		mesh,
		material,
		debrisGroup,
		debrisList,
		getCurrentWaterLevel,
		setWaterLevel,
		update,
		dispose
	};
}
