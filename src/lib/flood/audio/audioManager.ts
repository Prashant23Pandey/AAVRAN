export type SoundEffect =
	| 'warning_beep'
	| 'emergency_siren'
	| 'distant_siren'
	| 'radio_click'
	| 'radio_static'
	| 'radio_chatter'
	| 'success_chime'
	| 'water_alert_medium'
	| 'water_alert_high'
	| 'water_alert_critical'
	| 'decision_correct'
	| 'decision_wrong'
	| 'decision_continue'
	| 'training_complete'
	| 'earthquake_rumble'
	| 'structural_crack'
	| 'falling_debris'
	| 'debris_impact'
	| 'gas_leak_hiss'
	| 'blackout_shutdown'
	| 'aftershock_alert'
	| 'emergency_announcement'
	| 'thunder'
	| 'heavy_rain'
	| 'wind_gust'
	| 'water_splash'
	| 'water_flow'
	| 'electrical_buzz'
	| 'electrical_arc'
	| 'npc_alert'
	| 'footstep'
	| 'checkpoint'
	| 'stage_complete'
	| 'completion_fanfare';

export type AudioPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AudioCaption {
	icon: string;
	text: string;
	priority: AudioPriority;
}

export interface AudioVolumes {
	master: number;
	water: number; // Also serves as Environment Ambience
	alerts: number;
	ui: number;
}

export interface AudioManager {
	// Generic trigger
	play: (effect: SoundEffect, customLabel?: string) => void;

	// Ambience streams
	startWaterAmbience: () => void;
	stopWaterAmbience: () => void;
	setWaterIntensity: (intensity: number) => void;
	startRain: (intensity?: number) => void;
	stopRain: () => void;
	startElectricalCrackle: () => void;
	stopElectricalCrackle: () => void;
	startEarthquakeRumble: (intensity?: number) => void;
	stopEarthquakeRumble: () => void;
	startGasHiss: () => void;
	stopGasHiss: () => void;
	startFireAmbience: () => void;
	stopFireAmbience: () => void;

	// Dynamic system controls
	setDangerIntensity: (intensity: number) => void;
	getDangerIntensity: () => number;
	duckAmbience: (duckFactor?: number, duration?: number) => void;

	// Direct reusable procedural sound functions (as requested in spec #9)
	playRain: () => void;
	playThunder: () => void;
	playHeavyRain: () => void;
	playWind: () => void;
	playWaterFlow: () => void;
	playWaterSplash: () => void;
	playWarningBeep: (customLabel?: string) => void;
	playEmergencySiren: () => void;
	playDistantSiren: () => void;
	playRadioChatter: () => void;
	playElectricalBuzz: () => void;
	playElectricalArc: () => void;
	playStructuralCrack: () => void;
	playDebrisImpact: () => void;
	playFireAmbience: () => void;
	playGasHiss: () => void;
	playPowerShutdown: () => void;
	playEarthquakeRumble: (intensity?: number) => void;
	playAftershock: () => void;
	playFootsteps: (surface?: 'road' | 'wet' | 'grass' | 'concrete', isRunning?: boolean) => void;
	playInteraction: () => void;
	playNPCAlert: (name?: string) => void;
	playCorrectDecision: () => void;
	playIncorrectDecision: () => void;
	playEscortSuccess: (name?: string) => void;
	playCheckpoint: (cpNum?: number) => void;
	playStageComplete: (title?: string) => void;
	playCompletionFanfare: () => void;

	// Volume and state controls
	setVolume: (channel: keyof AudioVolumes, val: number) => void;
	getVolumes: () => AudioVolumes;
	setMuted: (muted: boolean) => void;
	isMuted: () => boolean;
	onFeedback: (cb: (label: string) => void) => () => void;
	onCaption: (cb: (caption: AudioCaption) => void) => () => void;
	dispose: () => void;
}

const STORAGE_KEY = 'flood_sim_audio_settings';

export function createAudioManager(): AudioManager {
	let audioCtx: AudioContext | null = null;
	let isMute = false;
	let dangerIntensity = 0.0; // 0.0 Calm -> 1.0 Extreme

	// Volume channels
	const volumes: AudioVolumes = {
		master: 0.8,
		water: 0.7,
		alerts: 0.85,
		ui: 0.75
	};

	// Try loading saved settings
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (typeof parsed.master === 'number') volumes.master = parsed.master;
				if (typeof parsed.water === 'number') volumes.water = parsed.water;
				if (typeof parsed.alerts === 'number') volumes.alerts = parsed.alerts;
				if (typeof parsed.ui === 'number') volumes.ui = parsed.ui;
			}
		} catch {
			// ignore storage error
		}
	}

	// Gain Nodes
	let masterGainNode: GainNode | null = null;
	let waterChannelNode: GainNode | null = null; // Ambience Channel
	let alertsChannelNode: GainNode | null = null; // High/Critical Alerts
	let uiChannelNode: GainNode | null = null; // Clicks, chimes
	let hazardChannelNode: GainNode | null = null; // Electrical, Fire, Gas

	// Water Ambience Nodes
	let waterOsc: OscillatorNode | null = null;
	let waterNoiseNode: AudioBufferSourceNode | null = null;
	let waterFilterNode: BiquadFilterNode | null = null;
	let waterGainNode: GainNode | null = null;

	// Rain Ambience Nodes
	let rainNoiseNode: AudioBufferSourceNode | null = null;
	let rainFilterNode: BiquadFilterNode | null = null;
	let rainGainNode: GainNode | null = null;

	// Electrical Hazard Nodes
	let crackleNode: AudioBufferSourceNode | null = null;
	let crackleFilter: BiquadFilterNode | null = null;
	let crackleGainNode: GainNode | null = null;

	// Disaster Storm Continuous Nodes
	let earthquakeOsc: OscillatorNode | null = null;
	let earthquakeOsc2: OscillatorNode | null = null;
	let earthquakeGainNode: GainNode | null = null;

	let gasNoiseNode: AudioBufferSourceNode | null = null;
	let gasFilterNode: BiquadFilterNode | null = null;
	let gasGainNode: GainNode | null = null;

	let fireNoiseNode: AudioBufferSourceNode | null = null;
	let fireFilterNode: BiquadFilterNode | null = null;
	let fireGainNode: GainNode | null = null;

	// Danger Tension Drone Nodes
	let dangerDroneOsc: OscillatorNode | null = null;
	let dangerDroneGain: GainNode | null = null;

	// Listeners
	const feedbackListeners: ((label: string) => void)[] = [];
	const captionListeners: ((caption: AudioCaption) => void)[] = [];

	function triggerFeedback(label: string, icon = '🔊', priority: AudioPriority = 'MEDIUM') {
		for (const cb of feedbackListeners) {
			cb(label);
		}
		const caption: AudioCaption = { icon, text: label, priority };
		for (const cb of captionListeners) {
			cb(caption);
		}
	}

	function getContext(): AudioContext | null {
		if (typeof window === 'undefined') return null;
		if (!audioCtx) {
			const AudioContextClass =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (AudioContextClass) {
				audioCtx = new AudioContextClass();
				setupGainGraph(audioCtx);
			}
		}
		if (audioCtx && audioCtx.state === 'suspended') {
			void audioCtx.resume();
		}
		return audioCtx;
	}

	function setupGainGraph(ctx: AudioContext) {
		masterGainNode = ctx.createGain();
		masterGainNode.gain.setValueAtTime(isMute ? 0 : volumes.master, ctx.currentTime);
		masterGainNode.connect(ctx.destination);

		waterChannelNode = ctx.createGain();
		waterChannelNode.gain.setValueAtTime(volumes.water, ctx.currentTime);
		waterChannelNode.connect(masterGainNode);

		alertsChannelNode = ctx.createGain();
		alertsChannelNode.gain.setValueAtTime(volumes.alerts, ctx.currentTime);
		alertsChannelNode.connect(masterGainNode);

		uiChannelNode = ctx.createGain();
		uiChannelNode.gain.setValueAtTime(volumes.ui, ctx.currentTime);
		uiChannelNode.connect(masterGainNode);

		hazardChannelNode = ctx.createGain();
		hazardChannelNode.gain.setValueAtTime(volumes.alerts * 0.75, ctx.currentTime);
		hazardChannelNode.connect(masterGainNode);

		// Initialize subtle low-frequency tension drone
		try {
			dangerDroneOsc = ctx.createOscillator();
			dangerDroneOsc.type = 'sine';
			dangerDroneOsc.frequency.setValueAtTime(42, ctx.currentTime);
			dangerDroneGain = ctx.createGain();
			dangerDroneGain.gain.setValueAtTime(0, ctx.currentTime);
			dangerDroneOsc.connect(dangerDroneGain);
			dangerDroneGain.connect(waterChannelNode);
			dangerDroneOsc.start();
		} catch {
			// ignore
		}
	}

	function createNoiseBuffer(ctx: AudioContext, duration = 3): AudioBuffer {
		const bufferSize = ctx.sampleRate * duration;
		const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		let lastOut = 0.0;
		for (let i = 0; i < bufferSize; i++) {
			const white = Math.random() * 2 - 1;
			// Pink-filtered noise for natural acoustic softness
			data[i] = (lastOut + 0.02 * white) / 1.02;
			lastOut = data[i];
			data[i] *= 3.5;
		}
		return buffer;
	}

	// Priority Ducking: Temporarily ducks ambient channels by 25-40%
	function duckAmbience(duckFactor = 0.35, duration = 2.2) {
		const ctx = getContext();
		if (!ctx || !waterChannelNode) return;
		try {
			const now = ctx.currentTime;
			const targetLow = volumes.water * duckFactor;
			waterChannelNode.gain.cancelScheduledValues(now);
			waterChannelNode.gain.setValueAtTime(waterChannelNode.gain.value, now);
			waterChannelNode.gain.linearRampToValueAtTime(targetLow, now + 0.12);
			waterChannelNode.gain.setTargetAtTime(volumes.water, now + 0.5, duration * 0.4);
		} catch {
			// ignore
		}
	}

	function setDangerIntensity(intensity: number) {
		dangerIntensity = Math.max(0, Math.min(1, intensity));
		const ctx = getContext();
		if (!ctx) return;
		const now = ctx.currentTime;

		// Modulate tension drone volume with danger intensity
		if (dangerDroneGain) {
			const targetGain = isMute ? 0 : dangerIntensity * 0.06;
			dangerDroneGain.gain.setTargetAtTime(targetGain, now, 0.5);
		}

		// Modulate water filter cutoff slightly with tension
		if (waterFilterNode) {
			const cutoff = 320 + dangerIntensity * 280;
			waterFilterNode.frequency.setTargetAtTime(cutoff, now, 0.5);
		}
	}

	function getDangerIntensity() {
		return dangerIntensity;
	}

	function play(effect: SoundEffect, customLabel?: string) {
		if (isMute) return;
		const ctx = getContext();
		if (!ctx || !alertsChannelNode || !uiChannelNode || !waterChannelNode) return;
		const alertsChannel = alertsChannelNode;
		const uiChannel = uiChannelNode;

		try {
			const now = ctx.currentTime;

			switch (effect) {
				case 'warning_beep': {
					duckAmbience(0.5, 1.2);
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'sine';
					osc.frequency.setValueAtTime(880, now);
					osc.frequency.setValueAtTime(660, now + 0.12);

					gain.gain.setValueAtTime(0.09, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

					osc.connect(gain);
					gain.connect(alertsChannel);
					osc.start(now);
					osc.stop(now + 0.3);
					triggerFeedback(customLabel || '⚠️ Alert Warning', '⚠️', 'HIGH');
					break;
				}

				case 'water_alert_medium': {
					duckAmbience(0.6, 1.5);
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'triangle';
					osc.frequency.setValueAtTime(550, now);
					osc.frequency.setValueAtTime(770, now + 0.15);

					gain.gain.setValueAtTime(0.12, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

					osc.connect(gain);
					gain.connect(alertsChannel);
					osc.start(now);
					osc.stop(now + 0.5);
					triggerFeedback(customLabel || '🌊 Water Rising: Advisory (+0.6m)', '🌊', 'MEDIUM');
					break;
				}

				case 'water_alert_high': {
					duckAmbience(0.4, 2.0);
					[660, 880, 990].forEach((freq, idx) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'sawtooth';
						osc.frequency.setValueAtTime(freq, now + idx * 0.12);

						gain.gain.setValueAtTime(0.1, now + idx * 0.12);
						gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.18);

						osc.connect(gain);
						gain.connect(alertsChannel);
						osc.start(now + idx * 0.12);
						osc.stop(now + idx * 0.12 + 0.18);
					});
					triggerFeedback(customLabel || '⚠️ Flood Alert: High Water (+1.4m)', '⚠️', 'HIGH');
					break;
				}

				case 'water_alert_critical': {
					duckAmbience(0.3, 2.5);
					for (let i = 0; i < 4; i++) {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'square';
						osc.frequency.setValueAtTime(i % 2 === 0 ? 1040 : 880, now + i * 0.1);

						gain.gain.setValueAtTime(0.12, now + i * 0.1);
						gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.08);

						osc.connect(gain);
						gain.connect(alertsChannel);
						osc.start(now + i * 0.1);
						osc.stop(now + i * 0.1 + 0.08);
					}
					triggerFeedback(customLabel || '🚨 CRITICAL FLOOD: Immediate Evacuation (+2.2m)', '🚨', 'CRITICAL');
					break;
				}

				case 'emergency_siren': {
					duckAmbience(0.25, 3.0);
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'triangle';
					osc.frequency.setValueAtTime(440, now);
					osc.frequency.linearRampToValueAtTime(660, now + 0.5);
					osc.frequency.linearRampToValueAtTime(440, now + 1.0);
					osc.frequency.linearRampToValueAtTime(660, now + 1.5);
					osc.frequency.linearRampToValueAtTime(440, now + 2.0);

					gain.gain.setValueAtTime(0.14, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 2.1);

					osc.connect(gain);
					gain.connect(alertsChannel);
					osc.start(now);
					osc.stop(now + 2.1);
					triggerFeedback(customLabel || '🚨 EMERGENCY SIREN ACTIVE', '🚨', 'CRITICAL');
					break;
				}

				case 'distant_siren': {
					duckAmbience(0.7, 2.0);
					const osc = ctx.createOscillator();
					const filter = ctx.createBiquadFilter();
					const gain = ctx.createGain();
					osc.type = 'sine';
					osc.frequency.setValueAtTime(480, now);
					osc.frequency.linearRampToValueAtTime(580, now + 0.8);
					osc.frequency.linearRampToValueAtTime(480, now + 1.6);

					filter.type = 'lowpass';
					filter.frequency.setValueAtTime(650, now);

					gain.gain.setValueAtTime(0.04, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

					osc.connect(filter);
					filter.connect(gain);
					gain.connect(waterChannelNode);
					osc.start(now);
					osc.stop(now + 2.2);
					triggerFeedback(customLabel || '📢 Distant Emergency Siren Echoing', '📢', 'LOW');
					break;
				}

				case 'radio_click':
				case 'radio_static': {
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'square';
					osc.frequency.setValueAtTime(140, now);

					gain.gain.setValueAtTime(0.05, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

					osc.connect(gain);
					gain.connect(uiChannel);
					osc.start(now);
					osc.stop(now + 0.07);
					if (customLabel) triggerFeedback(customLabel, '📻', 'LOW');
					break;
				}

				case 'radio_chatter': {
					// Squelch burst + resonant voice-band chatter emulation
					const noise = ctx.createBufferSource();
					noise.buffer = createNoiseBuffer(ctx, 0.6);
					const filter = ctx.createBiquadFilter();
					filter.type = 'bandpass';
					filter.frequency.setValueAtTime(1200, now);
					filter.Q.setValueAtTime(3.5, now);

					const gain = ctx.createGain();
					gain.gain.setValueAtTime(0.06, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

					noise.connect(filter);
					filter.connect(gain);
					gain.connect(uiChannel);
					noise.start(now);
					noise.stop(now + 0.6);
					triggerFeedback(customLabel || '📻 Emergency Radio Dispatch Chatter', '📻', 'MEDIUM');
					break;
				}

				case 'success_chime': {
					const notes = [698.46, 880.0, 1046.5];
					notes.forEach((freq, idx) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'sine';
						osc.frequency.setValueAtTime(freq, now + idx * 0.08);

						gain.gain.setValueAtTime(0.1, now + idx * 0.08);
						gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.5);

						osc.connect(gain);
						gain.connect(uiChannel);
						osc.start(now + idx * 0.08);
						osc.stop(now + idx * 0.08 + 0.5);
					});
					triggerFeedback(customLabel || '🤝 Resident Assisted', '🤝', 'MEDIUM');
					break;
				}

				case 'decision_correct': {
					[523.25, 659.25, 783.99].forEach((freq, idx) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'sine';
						osc.frequency.setValueAtTime(freq, now + idx * 0.06);

						gain.gain.setValueAtTime(0.12, now + idx * 0.06);
						gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.6);

						osc.connect(gain);
						gain.connect(uiChannel);
						osc.start(now + idx * 0.06);
						osc.stop(now + idx * 0.06 + 0.6);
					});
					triggerFeedback(customLabel || '✓ Protocol Correct (+0)', '✓', 'HIGH');
					break;
				}

				case 'decision_wrong': {
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'sawtooth';
					osc.frequency.setValueAtTime(130, now);
					osc.frequency.setValueAtTime(110, now + 0.2);

					gain.gain.setValueAtTime(0.14, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

					osc.connect(gain);
					gain.connect(uiChannel);
					osc.start(now);
					osc.stop(now + 0.45);
					triggerFeedback(customLabel || '⚠️ Unsafe Action (-15)', '⚠️', 'HIGH');
					break;
				}

				case 'decision_continue': {
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'triangle';
					osc.frequency.setValueAtTime(440, now);

					gain.gain.setValueAtTime(0.06, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

					osc.connect(gain);
					gain.connect(uiChannel);
					osc.start(now);
					osc.stop(now + 0.08);
					break;
				}

				case 'training_complete':
				case 'completion_fanfare': {
					duckAmbience(0.2, 4.0);
					const chord = [261.63, 329.63, 392.0, 523.25, 659.25];
					chord.forEach((freq, idx) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = idx >= 3 ? 'sine' : 'triangle';
						osc.frequency.setValueAtTime(freq, now + idx * 0.05);

						gain.gain.setValueAtTime(0.12, now + idx * 0.05);
						gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

						osc.connect(gain);
						gain.connect(uiChannel);
						osc.start(now + idx * 0.05);
						osc.stop(now + 2.5);
					});
					triggerFeedback(customLabel || '🏆 Training Complete: Safe Elevation Reached', '🏆', 'CRITICAL');
					break;
				}

				case 'earthquake_rumble': {
					duckAmbience(0.3, 3.5);
					const osc = ctx.createOscillator();
					const osc2 = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'triangle';
					osc2.type = 'sawtooth';
					osc.frequency.setValueAtTime(38, now);
					osc2.frequency.setValueAtTime(46, now);
					gain.gain.setValueAtTime(0.22, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);
					osc.connect(gain);
					osc2.connect(gain);
					gain.connect(alertsChannel);
					osc.start(now);
					osc2.start(now);
					osc.stop(now + 3.2);
					osc2.stop(now + 3.2);
					triggerFeedback(customLabel || '⚡ EARTHQUAKE SHAKING DETECTED', '⚡', 'CRITICAL');
					break;
				}

				case 'thunder': {
					duckAmbience(0.4, 3.0);
					const osc = ctx.createOscillator();
					const noise = ctx.createBufferSource();
					noise.buffer = createNoiseBuffer(ctx, 2.5);
					const filter = ctx.createBiquadFilter();
					const gain = ctx.createGain();

					osc.type = 'triangle';
					osc.frequency.setValueAtTime(80, now);
					osc.frequency.exponentialRampToValueAtTime(32, now + 2.2);

					filter.type = 'lowpass';
					filter.frequency.setValueAtTime(140, now);

					gain.gain.setValueAtTime(0.24, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);

					osc.connect(gain);
					noise.connect(filter);
					filter.connect(gain);
					gain.connect(alertsChannel);

					osc.start(now);
					noise.start(now);
					osc.stop(now + 2.8);
					noise.stop(now + 2.8);
					triggerFeedback(customLabel || '🌩️ Distant Thunder Rumbling', '🌩️', 'HIGH');
					break;
				}

				case 'heavy_rain': {
					const noise = ctx.createBufferSource();
					noise.buffer = createNoiseBuffer(ctx, 3.0);
					const filter = ctx.createBiquadFilter();
					filter.type = 'bandpass';
					filter.frequency.setValueAtTime(850, now);
					filter.Q.setValueAtTime(1.0, now);

					const gain = ctx.createGain();
					gain.gain.setValueAtTime(0.12, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

					noise.connect(filter);
					filter.connect(gain);
					gain.connect(waterChannelNode);
					noise.start(now);
					noise.stop(now + 3.0);
					triggerFeedback(customLabel || '🌧️ Heavy Downpour Intensifying', '🌧️', 'MEDIUM');
					break;
				}

				case 'wind_gust': {
					const noise = ctx.createBufferSource();
					noise.buffer = createNoiseBuffer(ctx, 2.5);
					const filter = ctx.createBiquadFilter();
					filter.type = 'bandpass';
					filter.frequency.setValueAtTime(300, now);
					filter.frequency.exponentialRampToValueAtTime(650, now + 1.2);
					filter.frequency.exponentialRampToValueAtTime(250, now + 2.4);

					const gain = ctx.createGain();
					gain.gain.setValueAtTime(0.08, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

					noise.connect(filter);
					filter.connect(gain);
					gain.connect(waterChannelNode);
					noise.start(now);
					noise.stop(now + 2.5);
					triggerFeedback(customLabel || '💨 Gale Wind Gust', '💨', 'LOW');
					break;
				}

				case 'water_splash': {
					const noise = ctx.createBufferSource();
					noise.buffer = createNoiseBuffer(ctx, 0.4);
					const filter = ctx.createBiquadFilter();
					filter.type = 'lowpass';
					filter.frequency.setValueAtTime(1400, now);
					filter.frequency.exponentialRampToValueAtTime(200, now + 0.35);

					const gain = ctx.createGain();
					gain.gain.setValueAtTime(0.15, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

					noise.connect(filter);
					filter.connect(gain);
					gain.connect(waterChannelNode);
					noise.start(now);
					noise.stop(now + 0.38);
					triggerFeedback(customLabel || '💦 Water Splash', '💦', 'LOW');
					break;
				}

				case 'water_flow': {
					const noise = ctx.createBufferSource();
					noise.buffer = createNoiseBuffer(ctx, 1.2);
					const filter = ctx.createBiquadFilter();
					filter.type = 'lowpass';
					filter.frequency.setValueAtTime(450, now);

					const gain = ctx.createGain();
					gain.gain.setValueAtTime(0.08, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

					noise.connect(filter);
					filter.connect(gain);
					gain.connect(waterChannelNode);
					noise.start(now);
					noise.stop(now + 1.2);
					break;
				}

				case 'electrical_buzz':
				case 'electrical_arc': {
					duckAmbience(0.6, 1.2);
					const osc = ctx.createOscillator();
					const osc2 = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'sawtooth';
					osc2.type = 'square';
					osc.frequency.setValueAtTime(120, now); // 120Hz power hum harmonic
					osc2.frequency.setValueAtTime(360, now);

					gain.gain.setValueAtTime(0.16, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

					osc.connect(gain);
					osc2.connect(gain);
					gain.connect(hazardChannelNode || alertsChannel);
					osc.start(now);
					osc2.start(now);
					osc.stop(now + 0.4);
					osc2.stop(now + 0.4);
					triggerFeedback(customLabel || '⚡ High Voltage Electrical Arc', '⚡', 'HIGH');
					break;
				}

				case 'structural_crack': {
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'sawtooth';
					osc.frequency.setValueAtTime(1400, now);
					osc.frequency.exponentialRampToValueAtTime(160, now + 0.25);
					gain.gain.setValueAtTime(0.18, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
					osc.connect(gain);
					gain.connect(alertsChannel);
					osc.start(now);
					osc.stop(now + 0.28);
					triggerFeedback(customLabel || '⚠️ Structural Fracture Sound', '⚠️', 'HIGH');
					break;
				}

				case 'falling_debris': {
					[0, 0.09, 0.21].forEach((delay, i) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'triangle';
						osc.frequency.setValueAtTime(120 - i * 25, now + delay);
						gain.gain.setValueAtTime(0.15, now + delay);
						gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
						osc.connect(gain);
						gain.connect(alertsChannel);
						osc.start(now + delay);
						osc.stop(now + delay + 0.15);
					});
					triggerFeedback(customLabel || '⚠️ Debris Falling', '⚠️', 'MEDIUM');
					break;
				}

				case 'debris_impact': {
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'triangle';
					osc.frequency.setValueAtTime(95, now);
					osc.frequency.exponentialRampToValueAtTime(25, now + 0.22);
					gain.gain.setValueAtTime(0.2, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
					osc.connect(gain);
					gain.connect(alertsChannel);
					osc.start(now);
					osc.stop(now + 0.25);
					triggerFeedback(customLabel || '💥 Concrete Debris Impact', '💥', 'HIGH');
					break;
				}

				case 'gas_leak_hiss': {
					const buf = createNoiseBuffer(ctx, 1.5);
					const src = ctx.createBufferSource();
					src.buffer = buf;
					const filter = ctx.createBiquadFilter();
					filter.type = 'bandpass';
					filter.frequency.setValueAtTime(3400, now);
					filter.Q.setValueAtTime(3.0, now);
					const gain = ctx.createGain();
					gain.gain.setValueAtTime(0.09, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
					src.connect(filter);
					filter.connect(gain);
					gain.connect(alertsChannel);
					src.start(now);
					src.stop(now + 1.4);
					triggerFeedback(customLabel || '💨 Gas Leak Hiss', '💨', 'HIGH');
					break;
				}

				case 'blackout_shutdown': {
					duckAmbience(0.4, 2.5);
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'sawtooth';
					osc.frequency.setValueAtTime(420, now);
					osc.frequency.exponentialRampToValueAtTime(45, now + 1.2);
					gain.gain.setValueAtTime(0.12, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
					osc.connect(gain);
					gain.connect(uiChannel);
					osc.start(now);
					osc.stop(now + 1.3);
					triggerFeedback(customLabel || '⚡ Power Grid Failure', '⚡', 'CRITICAL');
					break;
				}

				case 'aftershock_alert': {
					duckAmbience(0.3, 3.0);
					[640, 480, 640].forEach((freq, idx) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'square';
						osc.frequency.setValueAtTime(freq, now + idx * 0.14);
						gain.gain.setValueAtTime(0.12, now + idx * 0.14);
						gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.12);
						osc.connect(gain);
						gain.connect(alertsChannel);
						osc.start(now + idx * 0.14);
						osc.stop(now + idx * 0.14 + 0.12);
					});
					triggerFeedback(customLabel || '🚨 AFTERSHOCK WARNING', '🚨', 'CRITICAL');
					break;
				}

				case 'emergency_announcement': {
					duckAmbience(0.35, 2.0);
					[392.0, 493.88, 587.33].forEach((freq, idx) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'sine';
						osc.frequency.setValueAtTime(freq, now + idx * 0.15);
						gain.gain.setValueAtTime(0.14, now + idx * 0.15);
						gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.5);
						osc.connect(gain);
						gain.connect(alertsChannel);
						osc.start(now + idx * 0.15);
						osc.stop(now + idx * 0.15 + 0.5);
					});
					triggerFeedback(customLabel || '📢 Emergency Announcement', '📢', 'HIGH');
					break;
				}

				case 'npc_alert': {
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = 'sine';
					osc.frequency.setValueAtTime(740, now);
					osc.frequency.setValueAtTime(880, now + 0.08);

					gain.gain.setValueAtTime(0.08, now);
					gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

					osc.connect(gain);
					gain.connect(uiChannel);
					osc.start(now);
					osc.stop(now + 0.25);
					triggerFeedback(customLabel || '👥 Neighbor Calling For Help', '👥', 'MEDIUM');
					break;
				}

				case 'footstep': {
					// Lightweight procedural footstep
					const noise = ctx.createBufferSource();
					noise.buffer = createNoiseBuffer(ctx, 0.08);
					const filter = ctx.createBiquadFilter();
					filter.type = 'bandpass';
					filter.frequency.setValueAtTime(280, now);
					filter.Q.setValueAtTime(1.5, now);

					const gain = ctx.createGain();
					gain.gain.setValueAtTime(0.025, now);
					gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

					noise.connect(filter);
					filter.connect(gain);
					gain.connect(uiChannel);
					noise.start(now);
					noise.stop(now + 0.07);
					break;
				}

				case 'checkpoint': {
					[523.25, 783.99].forEach((freq, idx) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'triangle';
						osc.frequency.setValueAtTime(freq, now + idx * 0.1);

						gain.gain.setValueAtTime(0.1, now + idx * 0.1);
						gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);

						osc.connect(gain);
						gain.connect(uiChannel);
						osc.start(now + idx * 0.1);
						osc.stop(now + idx * 0.1 + 0.35);
					});
					triggerFeedback(customLabel || '💾 Checkpoint Saved', '💾', 'MEDIUM');
					break;
				}

				case 'stage_complete': {
					[587.33, 739.99, 880.0].forEach((freq, idx) => {
						const osc = ctx.createOscillator();
						const gain = ctx.createGain();
						osc.type = 'sine';
						osc.frequency.setValueAtTime(freq, now + idx * 0.08);

						gain.gain.setValueAtTime(0.12, now + idx * 0.08);
						gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);

						osc.connect(gain);
						gain.connect(uiChannel);
						osc.start(now + idx * 0.08);
						osc.stop(now + idx * 0.08 + 0.6);
					});
					triggerFeedback(customLabel || '🎯 Stage Complete', '🎯', 'HIGH');
					break;
				}
			}
		} catch {
			// Ignore audio errors gracefully
		}
	}

	// ── Procedural Footstep Generator ─────────────────────────────────────────
	function playFootsteps(surface: 'road' | 'wet' | 'grass' | 'concrete' = 'road', isRunning = false) {
		if (isMute) return;
		const ctx = getContext();
		if (!ctx || !uiChannelNode) return;
		try {
			const now = ctx.currentTime;
			const noise = ctx.createBufferSource();
			noise.buffer = createNoiseBuffer(ctx, 0.09);

			const filter = ctx.createBiquadFilter();
			filter.type = 'bandpass';

			let freq = 280;
			let q = 1.6;
			if (surface === 'wet') {
				freq = 680;
				q = 2.2;
			} else if (surface === 'grass') {
				freq = 420;
				q = 1.0;
			} else if (surface === 'concrete') {
				freq = 340;
				q = 1.8;
			}

			filter.frequency.setValueAtTime(freq, now);
			filter.Q.setValueAtTime(q, now);

			const gain = ctx.createGain();
			const volume = isRunning ? 0.045 : 0.028;
			gain.gain.setValueAtTime(volume, now);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + (isRunning ? 0.06 : 0.08));

			noise.connect(filter);
			filter.connect(gain);
			gain.connect(uiChannelNode);

			noise.start(now);
			noise.stop(now + (isRunning ? 0.06 : 0.08));
		} catch {
			// ignore
		}
	}

	// ── Explicit Helper Callbacks (Spec #9) ───────────────────────────────────
	function playRain() { play('heavy_rain', '🌧️ Steady Rainfall'); }
	function playThunder() { play('thunder', '🌩️ Thunder Clatter'); }
	function playHeavyRain() { play('heavy_rain', '🌧️ Torrential Downpour'); }
	function playWind() { play('wind_gust', '💨 Rising Storm Winds'); }
	function playWaterFlow() { play('water_flow', '🌊 River Surge'); }
	function playWaterSplash() { play('water_splash', '💦 Water Splash'); }
	function playWarningBeep(lbl?: string) { play('warning_beep', lbl || '⚠️ Hazard Alert'); }
	function playEmergencySiren() { play('emergency_siren', '🚨 Evacuation Siren'); }
	function playDistantSiren() { play('distant_siren', '📢 Distant City Siren'); }
	function playRadioChatter() { play('radio_chatter', '📻 Emergency Radio Broadcast'); }
	function playElectricalBuzz() { play('electrical_buzz', '⚡ High Voltage Hum'); }
	function playElectricalArc() { play('electrical_arc', '⚡ Power Line Flashover'); }
	function playStructuralCrack() { play('structural_crack', '⚠️ Structural Fracture'); }
	function playDebrisImpact() { play('debris_impact', '💥 Debris Collapsed'); }
	function playFireAmbience() { startFireAmbience(); }
	function playGasHiss() { play('gas_leak_hiss', '💨 Gas Line Hiss'); }
	function playPowerShutdown() { play('blackout_shutdown', '⚡ Grid Blackout'); }
	function playEarthquakeRumble(intensity = 0.8) {
		startEarthquakeRumble(intensity);
		setTimeout(() => stopEarthquakeRumble(), 3500);
	}
	function playAftershock() { play('aftershock_alert', '🚨 Strong Aftershock'); }
	function playInteraction() { play('radio_click', '🎯 Interaction Confirmed'); }
	function playNPCAlert(name?: string) { play('npc_alert', name ? `👥 ${name} needs help!` : '👥 Citizen calling for help'); }
	function playCorrectDecision() { play('decision_correct', '✓ Safe Protocol Choice (+0)'); }
	function playIncorrectDecision() { play('decision_wrong', '⚠️ Hazardous Decision (-15)'); }
	function playEscortSuccess(name?: string) { play('success_chime', name ? `🤝 Assisted ${name} to Safety` : '🤝 Resident Escorted to Safety'); }
	function playCheckpoint(cpNum?: number) { play('checkpoint', cpNum ? `💾 Checkpoint ${cpNum} Saved` : '💾 Checkpoint Reached'); }
	function playStageComplete(title?: string) { play('stage_complete', title ? `🎯 ${title} Complete` : '🎯 Stage Protocol Completed'); }
	function playCompletionFanfare() { play('completion_fanfare', '🏆 Training Successfully Completed!'); }

	// ── Ambience Loopers ──────────────────────────────────────────────────────
	function startRain(intensity = 0.5) {
		if (isMute || rainNoiseNode) return;
		const ctx = getContext();
		if (!ctx || !waterChannelNode) return;
		try {
			const now = ctx.currentTime;
			const buf = createNoiseBuffer(ctx, 3);
			rainNoiseNode = ctx.createBufferSource();
			rainNoiseNode.buffer = buf;
			rainNoiseNode.loop = true;

			rainFilterNode = ctx.createBiquadFilter();
			rainFilterNode.type = 'bandpass';
			rainFilterNode.frequency.setValueAtTime(1200, now);
			rainFilterNode.Q.setValueAtTime(0.8, now);

			rainGainNode = ctx.createGain();
			rainGainNode.gain.setValueAtTime(intensity * 0.05, now);

			rainNoiseNode.connect(rainFilterNode);
			rainFilterNode.connect(rainGainNode);
			rainGainNode.connect(waterChannelNode);

			rainNoiseNode.start(now);
		} catch {
			// ignore
		}
	}

	function stopRain() {
		try {
			if (rainNoiseNode) {
				rainNoiseNode.stop();
				rainNoiseNode.disconnect();
				rainNoiseNode = null;
			}
			if (rainFilterNode) {
				rainFilterNode.disconnect();
				rainFilterNode = null;
			}
			if (rainGainNode) {
				rainGainNode.disconnect();
				rainGainNode = null;
			}
		} catch {
			// ignore
		}
	}

	function startWaterAmbience() {
		if (isMute || waterOsc) return;
		const ctx = getContext();
		if (!ctx || !waterChannelNode) return;

		try {
			const now = ctx.currentTime;

			waterOsc = ctx.createOscillator();
			waterOsc.type = 'sine';
			waterOsc.frequency.setValueAtTime(58, now);

			const noiseBuffer = createNoiseBuffer(ctx, 4);
			waterNoiseNode = ctx.createBufferSource();
			waterNoiseNode.buffer = noiseBuffer;
			waterNoiseNode.loop = true;

			waterFilterNode = ctx.createBiquadFilter();
			waterFilterNode.type = 'lowpass';
			waterFilterNode.frequency.setValueAtTime(320, now);

			waterGainNode = ctx.createGain();
			waterGainNode.gain.setValueAtTime(0.04, now);

			waterNoiseNode.connect(waterFilterNode);
			waterFilterNode.connect(waterGainNode);
			waterOsc.connect(waterGainNode);
			waterGainNode.connect(waterChannelNode);

			waterOsc.start(now);
			waterNoiseNode.start(now);
		} catch {
			// Ignore
		}
	}

	function stopWaterAmbience() {
		try {
			if (waterOsc) {
				waterOsc.stop();
				waterOsc.disconnect();
				waterOsc = null;
			}
			if (waterNoiseNode) {
				waterNoiseNode.stop();
				waterNoiseNode.disconnect();
				waterNoiseNode = null;
			}
			if (waterFilterNode) {
				waterFilterNode.disconnect();
				waterFilterNode = null;
			}
			if (waterGainNode) {
				waterGainNode.disconnect();
				waterGainNode = null;
			}
		} catch {
			// Ignore
		}
	}

	function setWaterIntensity(intensity: number) {
		const clamped = Math.max(0, Math.min(1, intensity));
		const ctx = getContext();
		if (!ctx || !waterFilterNode || !waterGainNode) return;
		const now = ctx.currentTime;
		const cutoff = 260 + clamped * 700;
		waterFilterNode.frequency.setTargetAtTime(cutoff, now, 0.4);
		const gain = 0.03 + clamped * 0.08;
		waterGainNode.gain.setTargetAtTime(gain, now, 0.4);
	}

	function startElectricalCrackle() {
		if (isMute || crackleNode) return;
		const ctx = getContext();
		if (!ctx || !hazardChannelNode) return;

		try {
			const now = ctx.currentTime;
			const noiseBuffer = createNoiseBuffer(ctx, 2);
			crackleNode = ctx.createBufferSource();
			crackleNode.buffer = noiseBuffer;
			crackleNode.loop = true;

			crackleFilter = ctx.createBiquadFilter();
			crackleFilter.type = 'bandpass';
			crackleFilter.frequency.setValueAtTime(2600, now);
			crackleFilter.Q.setValueAtTime(5.0, now);

			crackleGainNode = ctx.createGain();
			crackleGainNode.gain.setValueAtTime(0.07, now);

			crackleNode.connect(crackleFilter);
			crackleFilter.connect(crackleGainNode);
			crackleGainNode.connect(hazardChannelNode);

			crackleNode.start(now);
			triggerFeedback('⚠️ Active High Voltage Electrical Perimeter', '⚡', 'HIGH');
		} catch {
			// Ignore
		}
	}

	function stopElectricalCrackle() {
		try {
			if (crackleNode) {
				crackleNode.stop();
				crackleNode.disconnect();
				crackleNode = null;
			}
			if (crackleFilter) {
				crackleFilter.disconnect();
				crackleFilter = null;
			}
			if (crackleGainNode) {
				crackleGainNode.disconnect();
				crackleGainNode = null;
			}
		} catch {
			// Ignore
		}
	}

	function startEarthquakeRumble(intensity = 0.7) {
		if (isMute || earthquakeOsc) return;
		const ctx = getContext();
		if (!ctx || !alertsChannelNode) return;
		try {
			const now = ctx.currentTime;
			earthquakeOsc = ctx.createOscillator();
			earthquakeOsc2 = ctx.createOscillator();
			earthquakeGainNode = ctx.createGain();

			earthquakeOsc.type = 'triangle';
			earthquakeOsc2.type = 'sawtooth';
			earthquakeOsc.frequency.setValueAtTime(32, now);
			earthquakeOsc2.frequency.setValueAtTime(44, now);

			const gainVal = 0.12 + intensity * 0.14;
			earthquakeGainNode.gain.setValueAtTime(gainVal, now);

			earthquakeOsc.connect(earthquakeGainNode);
			earthquakeOsc2.connect(earthquakeGainNode);
			earthquakeGainNode.connect(alertsChannelNode);

			earthquakeOsc.start(now);
			earthquakeOsc2.start(now);
			triggerFeedback('⚡ Severe Seismic Shaking Underway', '⚡', 'CRITICAL');
		} catch {
			// Ignore
		}
	}

	function stopEarthquakeRumble() {
		try {
			if (earthquakeOsc) {
				earthquakeOsc.stop();
				earthquakeOsc.disconnect();
				earthquakeOsc = null;
			}
			if (earthquakeOsc2) {
				earthquakeOsc2.stop();
				earthquakeOsc2.disconnect();
				earthquakeOsc2 = null;
			}
			if (earthquakeGainNode) {
				earthquakeGainNode.disconnect();
				earthquakeGainNode = null;
			}
		} catch {
			// Ignore
		}
	}

	function startGasHiss() {
		if (isMute || gasNoiseNode) return;
		const ctx = getContext();
		if (!ctx || !hazardChannelNode) return;
		try {
			const now = ctx.currentTime;
			const buf = createNoiseBuffer(ctx, 3);
			gasNoiseNode = ctx.createBufferSource();
			gasNoiseNode.buffer = buf;
			gasNoiseNode.loop = true;

			gasFilterNode = ctx.createBiquadFilter();
			gasFilterNode.type = 'bandpass';
			gasFilterNode.frequency.setValueAtTime(3600, now);
			gasFilterNode.Q.setValueAtTime(3.5, now);

			gasGainNode = ctx.createGain();
			gasGainNode.gain.setValueAtTime(0.065, now);

			gasNoiseNode.connect(gasFilterNode);
			gasFilterNode.connect(gasGainNode);
			gasGainNode.connect(hazardChannelNode);

			gasNoiseNode.start(now);
			triggerFeedback('💨 Pressurized Gas Leak Hissing', '💨', 'HIGH');
		} catch {
			// Ignore
		}
	}

	function stopGasHiss() {
		try {
			if (gasNoiseNode) {
				gasNoiseNode.stop();
				gasNoiseNode.disconnect();
				gasNoiseNode = null;
			}
			if (gasFilterNode) {
				gasFilterNode.disconnect();
				gasFilterNode = null;
			}
			if (gasGainNode) {
				gasGainNode.disconnect();
				gasGainNode = null;
			}
		} catch {
			// Ignore
		}
	}

	function startFireAmbience() {
		if (isMute || fireNoiseNode) return;
		const ctx = getContext();
		if (!ctx || !hazardChannelNode) return;
		try {
			const now = ctx.currentTime;
			const buf = createNoiseBuffer(ctx, 3);
			fireNoiseNode = ctx.createBufferSource();
			fireNoiseNode.buffer = buf;
			fireNoiseNode.loop = true;

			fireFilterNode = ctx.createBiquadFilter();
			fireFilterNode.type = 'lowpass';
			fireFilterNode.frequency.setValueAtTime(650, now);

			fireGainNode = ctx.createGain();
			fireGainNode.gain.setValueAtTime(0.05, now);

			fireNoiseNode.connect(fireFilterNode);
			fireFilterNode.connect(fireGainNode);
			fireGainNode.connect(hazardChannelNode);

			fireNoiseNode.start(now);
			triggerFeedback('🔥 Active Fire Perimeter Spreading', '🔥', 'HIGH');
		} catch {
			// Ignore
		}
	}

	function stopFireAmbience() {
		try {
			if (fireNoiseNode) {
				fireNoiseNode.stop();
				fireNoiseNode.disconnect();
				fireNoiseNode = null;
			}
			if (fireFilterNode) {
				fireFilterNode.disconnect();
				fireFilterNode = null;
			}
			if (fireGainNode) {
				fireGainNode.disconnect();
				fireGainNode = null;
			}
		} catch {
			// Ignore
		}
	}

	function persistSettings() {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(volumes));
			} catch {
				// Ignore
			}
		}
	}

	function setVolume(channel: keyof AudioVolumes, val: number) {
		const clamped = Math.max(0, Math.min(1, val));
		volumes[channel] = clamped;
		persistSettings();

		const ctx = getContext();
		if (!ctx) return;
		const now = ctx.currentTime;

		if (channel === 'master' && masterGainNode) {
			masterGainNode.gain.setTargetAtTime(isMute ? 0 : clamped, now, 0.05);
		} else if (channel === 'water' && waterChannelNode) {
			waterChannelNode.gain.setTargetAtTime(clamped, now, 0.05);
		} else if (channel === 'alerts' && alertsChannelNode) {
			alertsChannelNode.gain.setTargetAtTime(clamped, now, 0.05);
		} else if (channel === 'ui' && uiChannelNode) {
			uiChannelNode.gain.setTargetAtTime(clamped, now, 0.05);
		}
	}

	function getVolumes(): AudioVolumes {
		return { ...volumes };
	}

	function setMuted(muted: boolean) {
		isMute = muted;
		const ctx = getContext();
		if (ctx && masterGainNode) {
			masterGainNode.gain.setTargetAtTime(muted ? 0 : volumes.master, ctx.currentTime, 0.05);
		}
		if (muted) {
			stopElectricalCrackle();
			stopEarthquakeRumble();
			stopGasHiss();
			stopFireAmbience();
			stopRain();
		}
	}

	function isMuted() {
		return isMute;
	}

	function onFeedback(cb: (label: string) => void): () => void {
		feedbackListeners.push(cb);
		return () => {
			const idx = feedbackListeners.indexOf(cb);
			if (idx !== -1) feedbackListeners.splice(idx, 1);
		};
	}

	function onCaption(cb: (caption: AudioCaption) => void): () => void {
		captionListeners.push(cb);
		return () => {
			const idx = captionListeners.indexOf(cb);
			if (idx !== -1) captionListeners.splice(idx, 1);
		};
	}

	function dispose() {
		stopWaterAmbience();
		stopRain();
		stopElectricalCrackle();
		stopEarthquakeRumble();
		stopGasHiss();
		stopFireAmbience();
		if (dangerDroneOsc) {
			try {
				dangerDroneOsc.stop();
				dangerDroneOsc.disconnect();
				dangerDroneOsc = null;
			} catch {
				// ignore
			}
		}
		if (audioCtx && audioCtx.state !== 'closed') {
			void audioCtx.close();
			audioCtx = null;
		}
	}

	return {
		play,
		startWaterAmbience,
		stopWaterAmbience,
		setWaterIntensity,
		startRain,
		stopRain,
		startElectricalCrackle,
		stopElectricalCrackle,
		startEarthquakeRumble,
		stopEarthquakeRumble,
		startGasHiss,
		stopGasHiss,
		startFireAmbience,
		stopFireAmbience,
		setDangerIntensity,
		getDangerIntensity,
		duckAmbience,
		playRain,
		playThunder,
		playHeavyRain,
		playWind,
		playWaterFlow,
		playWaterSplash,
		playWarningBeep,
		playEmergencySiren,
		playDistantSiren,
		playRadioChatter,
		playElectricalBuzz,
		playElectricalArc,
		playStructuralCrack,
		playDebrisImpact,
		playFireAmbience,
		playGasHiss,
		playPowerShutdown,
		playEarthquakeRumble,
		playAftershock,
		playFootsteps,
		playInteraction,
		playNPCAlert,
		playCorrectDecision,
		playIncorrectDecision,
		playEscortSuccess,
		playCheckpoint,
		playStageComplete,
		playCompletionFanfare,
		setVolume,
		getVolumes,
		setMuted,
		isMuted,
		onFeedback,
		onCaption,
		dispose
	};
}
