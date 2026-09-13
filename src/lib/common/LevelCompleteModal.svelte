<script lang="ts">
	let {
		levelNumber,
		levelTitle,
		levelName,
		primaryCompleted = 0,
		primaryTotal = 0,
		optionalCompleted = 0,
		optionalTotal = 0,
		civiliansHelped = 0,
		hazardsIdentified = 0,
		safetyLesson = 'Follow official evacuation corridors and never enter hazardous areas.',
		nextLevelNumber,
		nextLevelName,
		onContinue,
		onSelectLevel
	}: {
		levelNumber: number;
		levelTitle?: string;
		levelName?: string;
		primaryCompleted?: number;
		primaryTotal?: number;
		optionalCompleted?: number;
		optionalTotal?: number;
		civiliansHelped?: number;
		hazardsIdentified?: number;
		safetyLesson?: string;
		nextLevelNumber?: number;
		nextLevelName?: string;
		onContinue: () => void;
		onSelectLevel?: (lvl: number) => void;
	} = $props();

	const displayTitle = $derived(levelName || levelTitle || `Level ${levelNumber}`);
	const displayNextNumber = $derived(nextLevelNumber || (levelNumber < 6 ? levelNumber + 1 : undefined));

	const MISSION_LEVELS = [
		{ num: 1, label: 'Level 1', desc: 'Alert & Readiness' },
		{ num: 2, label: 'Level 2', desc: 'Community Triage' },
		{ num: 3, label: 'Level 3', desc: 'Route Selection' },
		{ num: 4, label: 'Level 4', desc: 'Power Grid Hazard' },
		{ num: 5, label: 'Level 5', desc: 'Vulnerable Rescue' },
		{ num: 6, label: 'Level 6', desc: 'Summit Extraction' }
	];

	function handleLevelClick(targetNum: number) {
		if (onSelectLevel) {
			onSelectLevel(targetNum);
		} else if (targetNum === (displayNextNumber || levelNumber + 1)) {
			onContinue();
		}
	}
</script>

<div class="level-complete-backdrop" role="dialog" aria-modal="true" aria-labelledby="level-complete-title">
	<div class="level-complete-card">
		<!-- Top Bar: Badge & Close/Back Indicator -->
		<div class="card-header">
			<div class="complete-badge">
				<span class="badge-icon">✓</span>
				<span>MISSION LEVEL COMPLETE</span>
			</div>
			<span class="header-stamp">STATION SECURE</span>
		</div>

		<h2 id="level-complete-title" class="complete-title">
			Level {levelNumber} — {displayTitle}
		</h2>

		<p class="complete-subtitle">
			All primary emergency objectives fulfilled. Evacuation corridor confirmed for next operational phase.
		</p>

		<!-- Statistics Grid (Clean Light Pastel Cards) -->
		<div class="stats-grid">
			<div class="stat-box primary">
				<span class="stat-label">PRIMARY MISSIONS</span>
				<span class="stat-value">{primaryCompleted} / {primaryTotal}</span>
				<span class="stat-sub">100% Complete</span>
			</div>
			<div class="stat-box optional">
				<span class="stat-label">OPTIONAL MISSIONS</span>
				<span class="stat-value">{optionalCompleted} / {optionalTotal}</span>
				<span class="stat-sub">Bonus Readiness</span>
			</div>
			<div class="stat-box civilians">
				<span class="stat-label">CIVILIANS HELPED</span>
				<span class="stat-value">{civiliansHelped}</span>
				<span class="stat-sub">Escorted to Safety</span>
			</div>
			<div class="stat-box hazards">
				<span class="stat-label">HAZARDS IDENTIFIED</span>
				<span class="stat-value">{hazardsIdentified}</span>
				<span class="stat-sub">Perimeter Marked</span>
			</div>
		</div>

		<!-- Educational Safety Lesson Box -->
		<div class="lesson-box">
			<div class="lesson-header">
				<span class="lesson-icon">💡</span>
				<span class="lesson-title">CRITICAL SAFETY LESSON</span>
			</div>
			<p class="lesson-text">
				{safetyLesson}
			</p>
		</div>

		<!-- Direct Level Selection Section -->
		<div class="level-selector-section">
			<div class="selector-header">
				<span class="selector-title">🚀 JUMP DIRECTLY TO ANY MISSION LEVEL</span>
				<span class="selector-hint">Select below to play or replay any stage:</span>
			</div>
			<div class="level-btn-grid">
				{#each MISSION_LEVELS as lvl}
					<button
						type="button"
						class="level-jump-btn"
						class:current-completed={lvl.num === levelNumber}
						class:next-recommended={lvl.num === displayNextNumber}
						onclick={() => handleLevelClick(lvl.num)}
						title="Play {lvl.label}: {lvl.desc}"
					>
						<div class="lvl-btn-top">
							<span class="lvl-number">{lvl.label}</span>
							{#if lvl.num === levelNumber}
								<span class="status-pill done">✓ Done</span>
							{:else if lvl.num === displayNextNumber}
								<span class="status-pill next">Next ➜</span>
							{:else}
								<span class="status-pill goto">Go ➜</span>
							{/if}
						</div>
						<span class="lvl-desc">{lvl.desc}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Main Action Row -->
		<div class="action-row">
			<button type="button" class="btn-continue" onclick={onContinue} autofocus>
				<span>CONTINUE TO LEVEL {displayNextNumber || levelNumber + 1}</span>
				{#if nextLevelName}
					<span class="next-tag">({nextLevelName})</span>
				{/if}
				<span class="btn-arrow">→</span>
			</button>
		</div>
	</div>
</div>

<style>
	.level-complete-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.6);
		backdrop-filter: blur(10px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 1.5rem;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: scale(0.97); }
		to { opacity: 1; transform: scale(1); }
	}

	.level-complete-card {
		background: #ffffff;
		border: 1px solid #e2e8f0;
		box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05);
		border-radius: 1.25rem;
		max-width: 720px;
		width: 100%;
		padding: 2rem 2.25rem;
		color: #0f172a;
		font-family: inherit;
		position: relative;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.complete-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: #ecfdf5;
		border: 1px solid #a7f3d0;
		color: #059669;
		padding: 0.35rem 0.85rem;
		border-radius: 9999px;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.06em;
	}

	.header-stamp {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #94a3b8;
		text-transform: uppercase;
	}

	.badge-icon {
		font-size: 0.95rem;
		font-weight: 900;
	}

	.complete-title {
		font-size: 1.65rem;
		font-weight: 900;
		color: #0f172a;
		margin: 0 0 0.4rem 0;
		letter-spacing: -0.02em;
	}

	.complete-subtitle {
		font-size: 0.88rem;
		color: #64748b;
		margin: 0 0 1.25rem 0;
		line-height: 1.5;
	}

	/* Stats Grid with Clean Pastel Theme */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}

	.stat-box {
		border-radius: 0.85rem;
		padding: 0.85rem 0.65rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		border: 1px solid transparent;
		transition: transform 0.15s ease;
	}

	.stat-box:hover {
		transform: translateY(-2px);
	}

	.stat-box.primary {
		background: #f0fdf4;
		border-color: #bbf7d0;
	}

	.stat-box.primary .stat-value {
		color: #15803d;
	}

	.stat-box.optional {
		background: #f0f9ff;
		border-color: #bae6fd;
	}

	.stat-box.optional .stat-value {
		color: #0284c7;
	}

	.stat-box.civilians {
		background: #ecfeff;
		border-color: #a5f3fc;
	}

	.stat-box.civilians .stat-value {
		color: #0891b2;
	}

	.stat-box.hazards {
		background: #fffbeb;
		border-color: #fde68a;
	}

	.stat-box.hazards .stat-value {
		color: #d97706;
	}

	.stat-label {
		font-size: 0.65rem;
		font-weight: 800;
		color: #64748b;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
	}

	.stat-value {
		font-size: 1.45rem;
		font-weight: 900;
		line-height: 1.15;
		margin-bottom: 0.2rem;
	}

	.stat-sub {
		font-size: 0.68rem;
		font-weight: 600;
		color: #94a3b8;
	}

	/* Safety Lesson Box */
	.lesson-box {
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-left: 4px solid #f59e0b;
		border-radius: 0.65rem;
		padding: 0.9rem 1.15rem;
		margin-bottom: 1.25rem;
	}

	.lesson-header {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.72rem;
		font-weight: 800;
		color: #b45309;
		letter-spacing: 0.05em;
		margin-bottom: 0.3rem;
	}

	.lesson-text {
		font-size: 0.88rem;
		color: #78350f;
		margin: 0;
		line-height: 1.5;
		font-weight: 500;
	}

	/* Direct Level Selector Section */
	.level-selector-section {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.85rem;
		padding: 0.95rem 1.15rem;
		margin-bottom: 1.5rem;
	}

	.selector-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.7rem;
	}

	.selector-title {
		font-size: 0.72rem;
		font-weight: 800;
		color: #334155;
		letter-spacing: 0.06em;
	}

	.selector-hint {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.level-btn-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.55rem;
	}

	.level-jump-btn {
		background: #ffffff;
		border: 1.5px solid #cbd5e1;
		border-radius: 0.65rem;
		padding: 0.55rem 0.5rem;
		text-align: left;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		transition: all 0.18s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	}

	.level-jump-btn:hover {
		border-color: #059669;
		background: #f0fdf4;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
	}

	.level-jump-btn.current-completed {
		border-color: #86efac;
		background: #f0fdf4;
	}

	.level-jump-btn.next-recommended {
		border-color: #059669;
		background: #ecfdf5;
		box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
	}

	.lvl-btn-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.2rem;
	}

	.lvl-number {
		font-size: 0.72rem;
		font-weight: 900;
		color: #0f172a;
	}

	.status-pill {
		font-size: 0.58rem;
		font-weight: 800;
		padding: 0.1rem 0.35rem;
		border-radius: 9999px;
	}

	.status-pill.done {
		background: #dcfce7;
		color: #15803d;
	}

	.status-pill.next {
		background: #059669;
		color: #ffffff;
	}

	.status-pill.goto {
		background: #f1f5f9;
		color: #64748b;
	}

	.lvl-desc {
		font-size: 0.62rem;
		color: #64748b;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Action Row */
	.action-row {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 1rem;
	}

	.btn-continue {
		background: linear-gradient(135deg, #059669 0%, #047857 100%);
		color: #ffffff;
		border: none;
		border-radius: 0.75rem;
		padding: 0.85rem 1.85rem;
		font-size: 0.98rem;
		font-weight: 800;
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		cursor: pointer;
		box-shadow: 0 8px 20px -4px rgba(5, 150, 105, 0.4);
		transition: all 0.2s ease;
	}

	.btn-continue:hover {
		transform: translateY(-2px);
		box-shadow: 0 12px 25px -4px rgba(5, 150, 105, 0.5);
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
	}

	.next-tag {
		font-size: 0.82rem;
		font-weight: 600;
		opacity: 0.92;
	}

	.btn-arrow {
		font-size: 1.15rem;
		transition: transform 0.2s ease;
	}

	.btn-continue:hover .btn-arrow {
		transform: translateX(4px);
	}

	@media (max-width: 680px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.level-btn-grid {
			grid-template-columns: repeat(3, 1fr);
		}
		.btn-continue {
			width: 100%;
			justify-content: center;
		}
	}
</style>
