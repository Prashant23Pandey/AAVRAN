<script lang="ts">
	let {
		stageNumber,
		stageTitle,
		immediateDanger,
		safestDirection,
		whoNeedsHelp,
		whatToAvoid,
		onContinue
	}: {
		stageNumber: number;
		stageTitle: string;
		immediateDanger?: string;
		safestDirection?: string;
		whoNeedsHelp?: string;
		whatToAvoid?: string;
		onContinue: () => void;
	} = $props();
</script>

<div class="pause-backdrop" role="dialog" aria-modal="true" aria-labelledby="assess-title">
	<div class="assess-card">
		<!-- Header Badge -->
		<div class="assess-badge">
			<span class="badge-icon">⏸️</span>
			<span>TACTICAL PAUSE &amp; ASSESSMENT</span>
		</div>

		<div class="header-row">
			<div>
				<h2 id="assess-title" class="assess-title">Assess the Situation</h2>
				<p class="assess-stage">Level {stageNumber}: {stageTitle}</p>
			</div>
			<div class="training-clock-badge">
				<span class="pulse-dot"></span>
				<span>Simulation Suspended</span>
			</div>
		</div>

		<p class="assess-intro">
			Emergency responders never react on blind impulse. Take a deliberate moment to scan the environment,
			identify structural hazards, and choose the most defensible survival corridor.
		</p>

		<!-- 4 Fundamental Assessment Cards -->
		<div class="assess-grid">
			<div class="assess-item danger-card">
				<div class="item-head">
					<span class="item-icon">⚠️</span>
					<span class="item-label">1. What is the immediate danger?</span>
				</div>
				<p class="item-text">
					{immediateDanger ||
						'Rising torrent water, unstable submerged terrain, and flash flood surges in the valley.'}
				</p>
			</div>

			<div class="assess-item direction-card">
				<div class="item-head">
					<span class="item-icon">🧭</span>
					<span class="item-label">2. Where is the safest direction?</span>
				</div>
				<p class="item-text">
					{safestDirection ||
						'Uphill toward the marked orange safety beacons along the elevated hillside road.'}
				</p>
			</div>

			<div class="assess-item help-card">
				<div class="item-head">
					<span class="item-icon">🤝</span>
					<span class="item-label">3. Who needs help?</span>
				</div>
				<p class="item-text">
					{whoNeedsHelp ||
						'Elderly residents, children separated from families, and neighbors unaware of the flood advisory.'}
				</p>
			</div>

			<div class="assess-item avoid-card">
				<div class="item-head">
					<span class="item-icon">🚫</span>
					<span class="item-label">4. What should you avoid?</span>
				</div>
				<p class="item-text">
					{whatToAvoid ||
						'Never drive or wade through fast-moving water deeper than 15cm (6 in). Keep 10m clear of power lines.'}
				</p>
			</div>
		</div>

		<!-- Action Footer -->
		<div class="assess-footer">
			<div class="footer-tip">
				<span class="tip-icon">💡</span>
				<span><strong>Rule #1:</strong> "Turn Around, Don't Drown". Height is always safety.</span>
			</div>
			<button type="button" class="btn-continue" onclick={onContinue}>
				<span>Resume Training</span>
				<span class="btn-arrow">▶</span>
			</button>
		</div>
	</div>
</div>

<style>
	.pause-backdrop {
		position: absolute;
		inset: 0;
		z-index: 60;
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.assess-card {
		background: #ffffff;
		border: 1px solid rgba(2, 132, 199, 0.2);
		border-radius: 20px;
		max-width: 44rem;
		width: 100%;
		padding: 2rem 2.4rem;
		box-shadow: 0 25px 65px rgba(0, 0, 0, 0.15), 0 0 35px rgba(14, 165, 233, 0.08);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		color: #1e293b;
		animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes slideIn {
		from { opacity: 0; transform: scale(0.96) translateY(12px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.assess-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.12);
		border: 1px solid rgba(56, 189, 248, 0.28);
		padding: 0.3rem 0.8rem;
		border-radius: 999px;
		width: fit-content;
	}

	.header-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid #e2e8f0;
		padding-bottom: 0.9rem;
	}

	.assess-title {
		margin: 0;
		font-size: 1.8rem;
		font-weight: 900;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.assess-stage {
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #94a3b8;
	}

	.training-clock-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(234, 88, 12, 0.15);
		border: 1px solid rgba(234, 88, 12, 0.35);
		color: #fb923c;
		padding: 0.35rem 0.75rem;
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
	}

	.pulse-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #f97316;
		box-shadow: 0 0 8px #f97316;
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(0.8); }
	}

	.assess-intro {
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.5;
		color: #475569;
	}

	.assess-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	@media (max-width: 640px) {
		.assess-grid {
			grid-template-columns: 1fr;
		}
	}

	.assess-item {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.danger-card { border-left: 3px solid #ef4444; }
	.direction-card { border-left: 3px solid #10b981; }
	.help-card { border-left: 3px solid #38bdf8; }
	.avoid-card { border-left: 3px solid #f59e0b; }

	.item-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.item-icon {
		font-size: 1.1rem;
	}

	.item-label {
		font-size: 0.8rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #334155;
	}

	.item-text {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.45;
		color: #475569;
	}

	.assess-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		margin-top: 0.4rem;
		padding-top: 1rem;
		border-top: 1px solid #e2e8f0;
	}

	.footer-tip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.82rem;
		color: #64748b;
	}

	.tip-icon {
		font-size: 1.05rem;
	}

	.btn-continue {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		background: #0284c7;
		color: #ffffff;
		border: none;
		border-radius: 10px;
		padding: 0.75rem 1.5rem;
		font-size: 0.95rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.15s ease;
		box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
		flex-shrink: 0;
	}

	.btn-continue:hover {
		background: #0369a1;
		transform: translateY(-1px);
	}

	.btn-arrow {
		font-size: 0.8rem;
	}
</style>
