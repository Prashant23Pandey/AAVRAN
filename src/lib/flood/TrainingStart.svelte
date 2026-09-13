<script lang="ts">
	let {
		onStart,
		onExit
	}: {
		onStart: (mode: 'guided' | 'standard') => void;
		onExit?: () => void;
	} = $props();

	let currentTab = $state<'overview' | 'howToPlay' | 'safetyGuide'>('overview');
	let selectedMode = $state<'guided' | 'standard'>('guided');
</script>

<div class="start-backdrop" role="dialog" aria-modal="true" aria-labelledby="start-title">
	<div class="start-card">
		<!-- Header -->
		<div class="start-card-header">
			<div class="emergency-badge">
				<span class="pulse-beacon"></span>
				CIVIL DEFENSE & EMERGENCY MANAGEMENT
			</div>
			{#if onExit}
				<button type="button" class="btn-modal-back" onclick={onExit} aria-label="Back to Mode Selection">
					◂ Mode Menu
				</button>
			{/if}
		</div>

		<h1 id="start-title" class="start-title">FLOOD SURVIVAL</h1>
		<h2 class="start-subtitle">Interactive Emergency Training Simulation</h2>
		<p class="start-tagline">"Learn what to do before the water rises."</p>

		<!-- Navigation Tabs -->
		<div class="nav-tabs" role="tablist">
			<button
				type="button"
				role="tab"
				aria-selected={currentTab === 'overview'}
				class:active={currentTab === 'overview'}
				onclick={() => (currentTab = 'overview')}
			>
				Simulation Overview
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={currentTab === 'howToPlay'}
				class:active={currentTab === 'howToPlay'}
				onclick={() => (currentTab = 'howToPlay')}
			>
				How to Play
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={currentTab === 'safetyGuide'}
				class:active={currentTab === 'safetyGuide'}
				onclick={() => (currentTab = 'safetyGuide')}
			>
				Safety Guide
			</button>
		</div>

		<!-- Content Panels -->
		<div class="tab-content">
			{#if currentTab === 'overview'}
				<div class="overview-box">
					<p class="box-desc">
						A sudden flash flood is inundating the lower urban neighborhood. As water levels steadily rise, you must navigate from the flood basin to the high-elevation emergency rescue outpost while resolving real-time safety dilemmas.
					</p>
					<div class="features-grid">
						<div class="feature-item">
							<span class="feat-icon">🎯</span>
							<div>
								<strong>Interactive Decision Events</strong>
								<p>Encounter hazardous scenarios and make critical safety choices under pressure.</p>
							</div>
						</div>
						<div class="feature-item">
							<span class="feat-icon">📊</span>
							<div>
								<strong>Live Safety Score (100 pts)</strong>
								<p>Maintain your score by avoiding hazards and making informed evacuation decisions.</p>
							</div>
						</div>
						<div class="feature-item">
							<span class="feat-icon">🗺️</span>
							<div>
								<strong>Zone Indicators</strong>
								<p>Green Safe zones, Yellow Caution corridors, and Red Danger electrical hazards.</p>
							</div>
						</div>
					</div>
				</div>
			{:else if currentTab === 'howToPlay'}
				<div class="guide-box">
					<h3 class="guide-heading">Controls & Objectives</h3>
					<div class="keys-grid">
						<div class="key-item">
							<span class="key-combo">W A S D</span> / <span class="key-combo">↑ ← ↓ →</span>
							<span class="key-action">Move your trainee avatar</span>
						</div>
						<div class="key-item">
							<span class="key-combo">Left Click + Drag</span>
							<span class="key-action">Orbit camera perspective</span>
						</div>
					</div>
					<ul class="guide-list">
						<li>• <strong>Watch Water Telemetry:</strong> Keep eye on the rising water level gauge at the top-right.</li>
						<li>• <strong>Reach Green Beacons:</strong> Head toward the safe plateau (+5.8m) and the final summit outpost (+8.8m).</li>
						<li>• <strong>Resolve Emergency Prompts:</strong> When a scenario appears, choose the safest response to protect your score.</li>
					</ul>
				</div>
			{:else if currentTab === 'safetyGuide'}
				<div class="guide-box">
					<h3 class="guide-heading">Crucial Flood Survival Protocols</h3>
					<div class="protocols-list">
						<div class="protocol-card">
							<span class="protocol-num">01</span>
							<div>
								<strong>Turn Around, Don't Drown</strong>
								<p>Never walk or drive into flood water. Just 15 cm (6 in) of swift water can sweep adults off their feet; 30 cm (12 in) can float cars.</p>
							</div>
						</div>
						<div class="protocol-card">
							<span class="protocol-num">02</span>
							<div>
								<strong>Stay Clear of Electrical Hazards</strong>
								<p>Water conducts electricity over large distances. Keep at least 10 meters away from fallen lines and submerged boxes.</p>
							</div>
						</div>
						<div class="protocol-card">
							<span class="protocol-num">03</span>
							<div>
								<strong>Seek Vertical Elevation</strong>
								<p>Move upward to upper stories or designated rooftops. Avoid basements and never use elevators during floods.</p>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Training Mode Selector (Spec #18) -->
		<div class="mode-selector-box">
			<div class="mode-selector-label">
				<span class="mode-icon">🎓</span>
				<span>TRAINING MODE</span>
			</div>
			<div class="mode-buttons" role="radiogroup" aria-label="Select Training Mode">
				<button
					type="button"
					role="radio"
					aria-checked={selectedMode === 'guided'}
					class="mode-btn"
					class:active={selectedMode === 'guided'}
					onclick={() => (selectedMode = 'guided')}
				>
					<span class="mode-btn-title">Guided Mode</span>
					<span class="mode-btn-desc">More time, situational hints &amp; educational reviews (Recommended)</span>
				</button>
				<button
					type="button"
					role="radio"
					aria-checked={selectedMode === 'standard'}
					class="mode-btn"
					class:active={selectedMode === 'standard'}
					onclick={() => (selectedMode = 'standard')}
				>
					<span class="mode-btn-title">Standard Mode</span>
					<span class="mode-btn-desc">18s decision windows &amp; realistic pressure</span>
				</button>
			</div>
		</div>

		<!-- Action Footer -->
		<div class="start-footer">
			<button type="button" class="btn-start" onclick={() => onStart(selectedMode)}>
				Start Training Simulation →
			</button>
		</div>
	</div>
</div>

<style>
	.start-backdrop {
		position: absolute;
		inset: 0;
		z-index: 55;
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		animation: fadeIn 0.3s ease;
		overflow-y: auto;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.start-card {
		background: #ffffff;
		border-radius: 20px;
		max-width: 38rem;
		width: 100%;
		padding: 2rem 2.2rem;
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.9);
		display: flex;
		flex-direction: column;
		max-height: 88vh;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.start-card > * {
		flex-shrink: 0;
	}

	.start-card::-webkit-scrollbar {
		width: 6px;
	}

	.start-card::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 999px;
	}

	.start-card::-webkit-scrollbar-thumb {
		background: #94a3b8;
		border-radius: 999px;
	}

	.start-card::-webkit-scrollbar-thumb:hover {
		background: #64748b;
	}

	.start-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.8rem;
	}

	.emergency-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		color: #0284c7;
		background: #e0f2fe;
		padding: 0.25rem 0.7rem;
		border-radius: 999px;
		width: fit-content;
		margin-bottom: 0;
	}

	.btn-modal-back {
		background: #f1f5f9;
		border: 1px solid #cbd5e1;
		color: #475569;
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-modal-back:hover {
		background: #e2e8f0;
		color: #0f172a;
	}

	.pulse-beacon {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #0284c7;
		box-shadow: 0 0 8px #0284c7;
	}

	.start-title {
		margin: 0;
		font-size: 2.2rem;
		font-weight: 900;
		color: #0f172a;
		letter-spacing: -0.03em;
		line-height: 1;
	}

	.start-subtitle {
		margin: 0.4rem 0 0;
		font-size: 1.15rem;
		font-weight: 700;
		color: #0284c7;
	}

	.start-tagline {
		margin: 0.35rem 0 1.2rem;
		font-size: 0.95rem;
		font-style: italic;
		color: #64748b;
	}

	.nav-tabs {
		display: flex;
		gap: 0.4rem;
		background: #f1f5f9;
		padding: 0.25rem;
		border-radius: 10px;
		margin-bottom: 1.2rem;
	}

	.nav-tabs button {
		flex: 1;
		padding: 0.55rem 0.75rem;
		border: none;
		background: transparent;
		font-size: 0.82rem;
		font-weight: 600;
		color: #475569;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.nav-tabs button:hover {
		color: #0f172a;
	}

	.nav-tabs button.active {
		background: #ffffff;
		color: #0284c7;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
	}

	.tab-content {
		min-height: 180px;
		margin-bottom: 1.4rem;
	}

	.box-desc {
		margin: 0 0 1rem;
		font-size: 0.92rem;
		line-height: 1.5;
		color: #334155;
	}

	.features-grid {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.feature-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.65rem 0.85rem;
		background: #f8fafc;
		border-radius: 10px;
		border: 1px solid #e2e8f0;
	}

	.feat-icon {
		font-size: 1.2rem;
		margin-top: 1px;
	}

	.feature-item strong {
		display: block;
		font-size: 0.86rem;
		color: #0f172a;
	}

	.feature-item p {
		margin: 0.15rem 0 0;
		font-size: 0.78rem;
		color: #64748b;
	}

	.guide-box {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.guide-heading {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #475569;
	}

	.keys-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.key-item {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		background: #f8fafc;
		padding: 0.55rem 0.8rem;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
	}

	.key-combo {
		font-family: monospace;
		font-weight: 800;
		font-size: 0.85rem;
		background: #e2e8f0;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		color: #1e293b;
	}

	.key-action {
		font-size: 0.84rem;
		color: #334155;
	}

	.guide-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		font-size: 0.82rem;
		color: #334155;
	}

	.protocols-list {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.protocol-card {
		display: flex;
		align-items: flex-start;
		gap: 0.8rem;
		padding: 0.65rem 0.85rem;
		background: #f0fdf4;
		border-radius: 10px;
		border: 1px solid #bbf7d0;
	}

	.protocol-num {
		font-size: 1.1rem;
		font-weight: 900;
		color: #16a34a;
		line-height: 1;
		margin-top: 2px;
	}

	.protocol-card strong {
		display: block;
		font-size: 0.86rem;
		color: #166534;
	}

	.protocol-card p {
		margin: 0.2rem 0 0;
		font-size: 0.78rem;
		line-height: 1.4;
		color: #334155;
	}

	.mode-selector-box {
		background: #f8fafc;
		border: 1.5px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 0.4rem;
	}

	.mode-selector-label {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #0284c7;
	}

	.mode-buttons {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	.mode-btn {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 0.9rem;
		border-radius: 10px;
		border: 1.5px solid #e2e8f0;
		background: #ffffff;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.mode-btn:hover {
		border-color: #38bdf8;
		background: #f0f9ff;
	}

	.mode-btn.active {
		border-color: #0284c7;
		background: #eff6ff;
		box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.2);
	}

	.mode-btn-title {
		font-size: 0.88rem;
		font-weight: 800;
		color: #0f172a;
	}

	.mode-btn.active .mode-btn-title {
		color: #0369a1;
	}

	.mode-btn-desc {
		font-size: 0.75rem;
		line-height: 1.35;
		color: #64748b;
	}

	.start-footer {
		display: flex;
		justify-content: flex-end;
		border-top: 1px solid #e2e8f0;
		padding-top: 1.2rem;
	}

	.btn-start {
		padding: 0.85rem 1.8rem;
		background: #0284c7;
		color: #ffffff;
		border: none;
		border-radius: 10px;
		font-size: 1rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.15s ease;
		box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
	}

	.btn-start:hover {
		background: #0369a1;
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(2, 132, 199, 0.45);
	}
</style>
