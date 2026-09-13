<script lang="ts">
	import FloodScene from '$lib/flood/FloodScene.svelte';
	import DisasterStormScene from '$lib/disaster/DisasterStormScene.svelte';
	import MessengerScene from '$lib/messenger/MessengerScene.svelte';
	import type { SceneMode } from '$lib/messenger/introAssets';
	import { getOverviewStats, type SimulatorOverviewStats } from '$lib/common/storage';
	import { onMount } from 'svelte';

	const ANIMATION_STORY_URL = 'https://aavran-animation.vercel.app/';

	type ActiveView = 'menu' | 'flood' | 'disaster' | 'messenger';

	let activeView = $state<ActiveView>('menu');
	let sceneMode = $state<SceneMode>('intro');
	let stats = $state<SimulatorOverviewStats>({
		flood: { bestScore: null, grade: null, completed: false },
		disaster: { bestScore: null, grade: null, completed: false },
		overallReadiness: 0
	});

	onMount(() => {
		stats = getOverviewStats();
	});

	function enterMode(mode: 'flood' | 'disaster') {
		activeView = mode;
	}

	function exitToMenu() {
		// Refresh stats when returning
		stats = getOverviewStats();
		activeView = 'menu';
	}

	const messengerDescriptions: Record<SceneMode, string> = {
		intro: 'Intro planet with ported atlas, water, and cloud shaders.',
		gameplay: 'Present-day terrain, tree foliage, batched water, VFX props, and LUT outlines.',
		npcs: 'NPC gallery on a studio stage with static or skinned idle meshes.'
	};
</script>

<svelte:head>
	<title>Disaster Response Training Simulator — 3D Emergency Readiness</title>
	<meta
		name="description"
		content="Two-mode 3D Disaster Response Training Simulator. Train for flood evacuations and cascading multi-hazard disasters in an immersive, interactive environment."
	/>
</svelte:head>

<main id="app" class="simulation-app">
	{#if activeView === 'menu'}
		<!-- ===== MODE SELECTION MENU ===== -->
		<div class="menu-backdrop">
			<div class="menu-container">
				<!-- Header -->
				<div class="menu-header">
					<div class="header-badge">
						<span class="badge-dot"></span>
						DISASTER RESPONSE TRAINING SIMULATOR
					</div>
					<h1 class="menu-title">Select Training Mode</h1>
					<p class="menu-subtitle">
						Two immersive 3D emergency readiness simulations. Choose your scenario and develop
						critical survival skills.
					</p>
				</div>

				<!-- Overall Readiness Bar -->
				{#if stats.overallReadiness > 0}
					<div class="readiness-bar-box">
						<div class="readiness-label-row">
							<span class="readiness-label">OVERALL READINESS</span>
							<span class="readiness-val">{stats.overallReadiness}%</span>
						</div>
						<div class="readiness-track">
							<div
								class="readiness-fill"
								style:width="{stats.overallReadiness}%"
								class:high={stats.overallReadiness >= 75}
							></div>
						</div>
					</div>
				{/if}

				<!-- Mode Cards -->
				<div class="mode-cards">
					<!-- MODE 1: FLOOD READY -->
					<button
						type="button"
						class="mode-card flood-card"
						onclick={() => enterMode('flood')}
						aria-label="Enter Flood Ready training mode"
					>
						<div class="card-ribbon flood-ribbon">MODE 1</div>
						<div class="card-icon">🌊</div>
						<h2 class="card-title">FLOOD READY</h2>
						<p class="card-desc">
							6-level rising flood emergency simulation. Navigate a flooded river basin, complete multi-objective
							field missions, assist 10 community members, and make critical evacuation decisions.
						</p>
						<div class="card-meta-row">
							<span class="card-meta-item">⏱ 15–20 min</span>
							<span class="card-meta-item">🎓 6 Levels</span>
							<span class="card-meta-item">👥 10 Civilians</span>
						</div>
						{#if stats.flood.bestScore !== null}
							<div class="card-score-row">
								<span class="card-score-label">Best Score</span>
								<span class="card-score-val">{stats.flood.bestScore}/100</span>
								{#if stats.flood.grade}
									<span class="card-grade-badge">{stats.flood.grade}</span>
								{/if}
							</div>
						{:else}
							<div class="card-score-row unplayed">
								<span class="card-score-label">Not yet completed</span>
							</div>
						{/if}
						<div class="card-cta flood-cta">
							<span>Start Training</span>
							<span class="cta-arrow">→</span>
						</div>
					</button>

					<!-- MODE 2: DISASTER STORM -->
					<button
						type="button"
						class="mode-card disaster-card"
						onclick={() => enterMode('disaster')}
						aria-label="Enter Disaster Storm training mode"
					>
						<div class="card-ribbon disaster-ribbon">MODE 2</div>
						<div class="card-icon">⛈</div>
						<h2 class="card-title">DISASTER STORM</h2>
						<p class="card-desc">
							6-level cascading multi-hazard disaster. Survive an earthquake, secondary fire, gas
							leak, blackout, and aftershock while evacuating your community to safety.
						</p>
						<div class="card-meta-row">
							<span class="card-meta-item">⏱ 15–20 min</span>
							<span class="card-meta-item">🎓 6 Levels</span>
							<span class="card-meta-item">⚡ Cascading Hazards</span>
						</div>
						{#if stats.disaster.bestScore !== null}
							<div class="card-score-row">
								<span class="card-score-label">Best Score</span>
								<span class="card-score-val">{stats.disaster.bestScore}/100</span>
								{#if stats.disaster.grade}
									<span class="card-grade-badge disaster-grade">{stats.disaster.grade}</span>
								{/if}
							</div>
						{:else}
							<div class="card-score-row unplayed">
								<span class="card-score-label">Not yet completed</span>
							</div>
						{/if}
						<div class="card-cta disaster-cta">
							<span>Start Training</span>
							<span class="cta-arrow">→</span>
						</div>
					</button>
				</div>

				<!-- Animation and Story button -->
				<div class="footer-links">
					<a
						href={ANIMATION_STORY_URL}
						target="_blank"
						rel="noopener noreferrer"
						class="ref-link"
						aria-label="Open Animation and Story in new tab"
					>
						<svg
							class="ref-icon"
							viewBox="0 0 24 24"
							width="16"
							height="16"
							fill="currentColor"
							aria-hidden="true"
						>
							<path d="M8 5v14l11-7z" />
						</svg>
						<span>Animation and Story</span>
					</a>
				</div>
			</div>
		</div>
	{:else if activeView === 'flood'}
		<FloodScene onExitToMenu={exitToMenu} />
	{:else if activeView === 'disaster'}
		<DisasterStormScene onExitToMenu={exitToMenu} />
	{:else}
		<!-- Messenger Reference Archive -->
		<div class="ref-view-wrapper">
			{#key sceneMode}
				<MessengerScene mode={sceneMode} />
			{/key}
			<header class="top-nav-bar">
				<div class="brand-group">
					<div class="simulation-badge">REFERENCE ARCHIVE</div>
					<h1 class="app-title">Messenger Scene Viewer</h1>
				</div>
				<div class="view-switcher" role="tablist" aria-label="Messenger Scene Mode">
					<button
						type="button"
						role="tab"
						aria-selected={sceneMode === 'intro'}
						class:active={sceneMode === 'intro'}
						onclick={() => (sceneMode = 'intro')}
					>
						Intro
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={sceneMode === 'gameplay'}
						class:active={sceneMode === 'gameplay'}
						onclick={() => (sceneMode = 'gameplay')}
					>
						Gameplay
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={sceneMode === 'npcs'}
						class:active={sceneMode === 'npcs'}
						onclick={() => (sceneMode = 'npcs')}
					>
						NPCs
					</button>
				</div>
				<button type="button" class="nav-back-btn" onclick={exitToMenu}>◂ Menu</button>
			</header>
			<p class="mode-caption" aria-live="polite">{messengerDescriptions[sceneMode]}</p>
		</div>
	{/if}
</main>

<style>
	.simulation-app {
		position: absolute;
		inset: 0;
		overflow: hidden;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
	}

	/* ======================================
	   MENU BACKDROP
	   ====================================== */
	.menu-backdrop {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(8, 15, 28, 0.58) 0%, rgba(8, 15, 28, 0.38) 40%, rgba(8, 15, 28, 0.65) 100%),
			url('/menu-bg.jpg') center / cover no-repeat;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		overflow-y: auto;
	}

	.menu-container {
		max-width: 56rem;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	/* Header */
	.menu-header {
		text-align: center;
	}

	.header-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		color: #7dd3fc;
		background: rgba(15, 23, 42, 0.85);
		border: 1px solid rgba(125, 211, 252, 0.4);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-radius: 999px;
		padding: 0.35rem 1rem;
		margin-bottom: 1rem;
	}

	.badge-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #38bdf8;
		box-shadow: 0 0 8px #38bdf8;
		animation: pulseDot 2s infinite ease-in-out;
	}

	@keyframes pulseDot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(0.75); }
	}

	.menu-title {
		margin: 0 0 0.6rem;
		font-size: 2.4rem;
		font-weight: 900;
		color: #ffffff;
		letter-spacing: -0.03em;
		line-height: 1.1;
		text-shadow: 0 2px 16px rgba(0, 0, 0, 0.8), 0 1px 3px rgba(0, 0, 0, 0.9);
	}

	.menu-subtitle {
		margin: 0;
		font-size: 1rem;
		color: #f1f5f9;
		font-weight: 500;
		line-height: 1.55;
		max-width: 40rem;
		margin-inline: auto;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
	}

	/* Readiness Bar */
	.readiness-bar-box {
		background: rgba(15, 23, 42, 0.82);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 14px;
		padding: 1rem 1.4rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
	}

	.readiness-label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.55rem;
	}

	.readiness-label {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #cbd5e1;
	}

	.readiness-val {
		font-size: 1.1rem;
		font-weight: 900;
		color: #38bdf8;
	}

	.readiness-track {
		height: 6px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		overflow: hidden;
	}

	.readiness-fill {
		height: 100%;
		background: #38bdf8;
		border-radius: 999px;
		transition: width 0.8s ease;
	}

	.readiness-fill.high {
		background: linear-gradient(90deg, #22c55e, #38bdf8);
	}

	/* Mode Cards */
	.mode-cards {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.mode-card {
		position: relative;
		background: rgba(15, 23, 42, 0.82);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1.5px solid rgba(255, 255, 255, 0.16);
		border-radius: 24px;
		padding: 2rem 1.75rem 1.6rem;
		text-align: left;
		cursor: pointer;
		transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
	}

	.mode-card:hover {
		transform: translateY(-4px);
		background: rgba(15, 23, 42, 0.92);
		box-shadow: 0 24px 50px rgba(0, 0, 0, 0.6);
	}

	.flood-card:hover {
		border-color: rgba(56, 189, 248, 0.7);
		box-shadow: 0 20px 50px rgba(56, 189, 248, 0.2);
	}

	.disaster-card:hover {
		border-color: rgba(251, 146, 60, 0.7);
		box-shadow: 0 20px 50px rgba(251, 146, 60, 0.2);
	}

	.card-ribbon {
		position: absolute;
		top: 1.1rem;
		right: 1.1rem;
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		padding: 0.22rem 0.6rem;
		border-radius: 999px;
	}

	.flood-ribbon {
		background: rgba(56, 189, 248, 0.22);
		color: #bae6fd;
		border: 1px solid rgba(56, 189, 248, 0.45);
	}

	.disaster-ribbon {
		background: rgba(251, 146, 60, 0.22);
		color: #fed7aa;
		border: 1px solid rgba(251, 146, 60, 0.45);
	}

	.card-icon {
		font-size: 2.2rem;
		line-height: 1;
	}

	.card-title {
		margin: 0;
		font-size: 1.45rem;
		font-weight: 900;
		color: #ffffff;
		letter-spacing: -0.01em;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
	}

	.card-desc {
		margin: 0;
		font-size: 0.88rem;
		color: #cbd5e1;
		line-height: 1.55;
		flex: 1;
	}

	.card-meta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.card-meta-item {
		font-size: 0.72rem;
		font-weight: 700;
		color: #e2e8f0;
		background: rgba(255, 255, 255, 0.09);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 999px;
		padding: 0.25rem 0.6rem;
	}

	.card-score-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 0.55rem 0.9rem;
	}

	.card-score-row.unplayed {
		opacity: 0.75;
	}

	.card-score-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: #94a3b8;
		letter-spacing: 0.04em;
	}

	.card-score-val {
		font-size: 1.05rem;
		font-weight: 900;
		color: #38bdf8;
		margin-left: auto;
	}

	.card-grade-badge {
		font-size: 0.65rem;
		font-weight: 800;
		color: #22c55e;
		background: rgba(34, 197, 94, 0.12);
		border: 1px solid rgba(34, 197, 94, 0.2);
		border-radius: 999px;
		padding: 0.15rem 0.5rem;
		white-space: nowrap;
	}

	.card-grade-badge.disaster-grade {
		color: #fb923c;
		background: rgba(251, 146, 60, 0.12);
		border-color: rgba(251, 146, 60, 0.2);
	}

	.card-cta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.9rem;
		font-weight: 800;
		border-radius: 12px;
		padding: 0.75rem 1.1rem;
		transition: all 0.15s ease;
	}

	.flood-cta {
		background: linear-gradient(135deg, #0ea5e9, #0284c7);
		color: #ffffff;
	}

	.disaster-cta {
		background: linear-gradient(135deg, #f97316, #dc2626);
		color: #ffffff;
	}

	.mode-card:hover .flood-cta {
		background: linear-gradient(135deg, #38bdf8, #0ea5e9);
	}

	.mode-card:hover .disaster-cta {
		background: linear-gradient(135deg, #fb923c, #ef4444);
	}

	.cta-arrow {
		font-size: 1.1rem;
		transition: transform 0.15s ease;
	}

	.mode-card:hover .cta-arrow {
		transform: translateX(4px);
	}

	/* Footer Links */
	.footer-links {
		display: flex;
		justify-content: center;
	}

	.ref-link {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		text-decoration: none;
		border: 1px solid rgba(255, 255, 255, 0.22);
		background: rgba(15, 23, 42, 0.8);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		color: #f1f5f9;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		padding: 0.55rem 1.25rem;
		border-radius: 999px;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
		transition: all 0.2s ease;
	}

	.ref-link:hover {
		color: #ffffff;
		background: rgba(15, 23, 42, 0.95);
		border-color: rgba(56, 189, 248, 0.5);
		box-shadow: 0 8px 24px rgba(56, 189, 248, 0.25), 0 8px 24px rgba(0, 0, 0, 0.5);
		transform: translateY(-1px) scale(1.02);
	}

	.ref-link:active {
		transform: translateY(0) scale(0.99);
	}

	.ref-icon {
		flex-shrink: 0;
		transition: transform 0.2s ease, color 0.2s ease;
	}

	.ref-link:hover .ref-icon {
		transform: scale(1.1);
		color: #38bdf8;
	}

	/* ======================================
	   FLOOD / DISASTER VIEWS
	   ====================================== */
	.back-to-menu-btn {
		position: absolute;
		top: 1.25rem;
		left: 1.25rem;
		z-index: 25;
		border: none;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(8px);
		color: #334155;
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
		transition: all 0.15s ease;
	}

	.back-to-menu-btn:hover {
		background: #ffffff;
		color: #0f172a;
	}

	/* ======================================
	   REFERENCE ARCHIVE VIEW
	   ====================================== */
	.ref-view-wrapper {
		position: absolute;
		inset: 0;
		background: #b8cbd6;
		overflow: hidden;
	}

	.top-nav-bar {
		position: absolute;
		top: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 15;
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.65rem 1.25rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(12px);
		box-shadow: 0 8px 30px rgba(15, 30, 45, 0.12);
		border: 1px solid rgba(255, 255, 255, 0.8);
	}

	.brand-group {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.simulation-badge {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #0284c7;
		background: #e0f2fe;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
	}

	.app-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 800;
		color: #0f172a;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	.view-switcher {
		display: flex;
		background: #f1f5f9;
		border-radius: 999px;
		padding: 0.2rem;
		gap: 0.2rem;
	}

	.view-switcher button {
		border: none;
		background: transparent;
		padding: 0.35rem 0.85rem;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 600;
		color: #475569;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.view-switcher button:hover {
		color: #0f172a;
	}

	.view-switcher button.active {
		background: #ffffff;
		color: #0284c7;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
	}

	.nav-back-btn {
		border: none;
		background: #f1f5f9;
		color: #334155;
		padding: 0.35rem 0.85rem;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s;
	}

	.nav-back-btn:hover {
		background: #e2e8f0;
		color: #0f172a;
	}

	.mode-caption {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.6);
		display: none;
	}

	@media (max-width: 720px) {
		.menu-title {
			font-size: 1.7rem;
		}

		.mode-cards {
			grid-template-columns: 1fr;
		}

		.top-nav-bar {
			top: 0.75rem;
			max-width: 95vw;
			flex-wrap: wrap;
			border-radius: 16px;
			justify-content: center;
		}
	}
</style>
