<script lang="ts">
	let { onClose }: { onClose: () => void } = $props();

	const lessons = [
		{
			num: 1,
			icon: '🌎',
			title: 'DROP, COVER, AND HOLD ON',
			subtitle: 'Immediate Seismic Response',
			summary:
				'During active shaking, immediately drop to your hands and knees. Cover your head and neck beneath sturdy furniture (desks, tables) and hold on until shaking ceases.',
			rules: [
				'Do NOT run outside while the ground is shaking—falling glass and architectural facades kill more people than building collapses.',
				'Stay clear of large windows, glass partitions, and hanging fixtures.',
				'If in bed, stay there and curl up, protecting your head with a pillow.'
			]
		},
		{
			num: 2,
			icon: '🏢',
			title: 'STAY CLEAR OF DAMAGED STRUCTURES',
			subtitle: 'Post-Quake Structural Hazard',
			summary:
				'Compromised buildings can collapse without warning from minor aftershocks or gravity load redistributions.',
			rules: [
				'Never re-enter buildings to retrieve personal belongings or documents.',
				'Maintain a safety perimeter at least equal to building height (fall zone).',
				'Watch for cracked parapets, loose chimney masonry, and shattered glass.'
			]
		},
		{
			num: 3,
			icon: '🔥',
			title: 'EXPECT SECONDARY HAZARDS: FIRES',
			subtitle: 'Secondary Disaster Cascade',
			summary:
				'Secondary fires sparked by severed power cables and broken gas lines are historically the deadliest component of major earthquakes.',
			rules: [
				'Never use water on suspected electrical fires.',
				'Evacuate immediately upwind from spreading smoke and thermal radiation.',
				'Report exact fire coordinates to emergency dispatch to facilitate fire line containment.'
			]
		},
		{
			num: 4,
			icon: '💨',
			title: 'AVOID SPARKS NEAR SUSPECTED GAS LEAKS',
			subtitle: 'Explosion Prevention',
			summary:
				'Natural gas leaks form explosive vapor clouds that collect in basements, street depressions, and valleys.',
			rules: [
				'Do NOT flip electrical switches, light matches, or ring doorbells near a gas odor.',
				'If you smell sulfur or rotten eggs, evacuate the area immediately on foot.',
				'Notify emergency responders and utility crews from at least 100 meters upwind.'
			]
		},
		{
			num: 5,
			icon: '⚡',
			title: 'AVOID DAMAGED ELECTRICAL INFRASTRUCTURE',
			subtitle: 'Electrocution & Arc Flash Hazards',
			summary:
				'Fallen cables and collapsed transformers energize wet ground, puddles, and metallic fences over wide radii.',
			rules: [
				'Assume all downed power lines are energized (live) at all times.',
				'Keep at least 10 meters (33 feet) away from downed cables.',
				'If a wire touches your vehicle, stay inside until emergency crews arrive.'
			]
		},
		{
			num: 6,
			icon: '🏃',
			title: 'USE DESIGNATED EVACUATION ROUTES & ASSEMBLY AREAS',
			subtitle: 'Orderly Community Movement',
			summary:
				'The shortest route on a map is often the most dangerous. Always prioritize designated open-sky corridors clear of collapse perimeters.',
			rules: [
				'Avoid narrow street canyons with cracked multi-story buildings overhead.',
				'Check in at the official Emergency Assembly Area so responders can account for you.',
				'Never attempt independent amateur search-and-rescue without incident command coordination.'
			]
		}
	];
</script>

<div class="guide-backdrop" role="dialog" aria-modal="true" aria-labelledby="guide-title">
	<div class="guide-card">
		<div class="guide-header">
			<div class="header-badge">
				<span>📖</span>
				OFFICIAL DISASTER SURVIVAL GUIDE
			</div>
			<button type="button" class="close-btn" onclick={onClose} aria-label="Close safety guide">✕</button>
		</div>

		<h2 id="guide-title" class="guide-title">Multi-Hazard Emergency Preparedness</h2>
		<p class="guide-desc">
			Essential protocols for surviving primary earthquake shocks and the cascading secondary hazards that follow.
		</p>

		<div class="lessons-scroll">
			{#each lessons as lesson}
				<div class="lesson-card">
					<div class="lesson-top">
						<div class="lesson-badge">
							<span class="lesson-icon">{lesson.icon}</span>
							<span class="lesson-num">LESSON {lesson.num}</span>
						</div>
						<span class="lesson-sub">{lesson.subtitle}</span>
					</div>

					<h3 class="lesson-heading">{lesson.title}</h3>
					<p class="lesson-summary">{lesson.summary}</p>

					<div class="rules-box">
						<span class="rules-label">Critical Rules:</span>
						<ul class="rules-list">
							{#each lesson.rules as rule}
								<li>• {rule}</li>
							{/each}
						</ul>
					</div>
				</div>
			{/each}
		</div>

		<div class="guide-footer">
			<button type="button" class="btn-primary" onclick={onClose}>
				Close Safety Guide
			</button>
		</div>
	</div>
</div>

<style>
	.guide-backdrop {
		position: absolute;
		inset: 0;
		z-index: 80;
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		animation: fadeIn 0.25s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.guide-card {
		background: #ffffff;
		border-radius: 24px;
		max-width: 44rem;
		width: 100%;
		padding: 2.2rem;
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.85);
		display: flex;
		flex-direction: column;
		max-height: 90vh;
	}

	.guide-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.header-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #b45309;
		background: #fef3c7;
		border: 1px solid #fde68a;
		padding: 0.25rem 0.7rem;
		border-radius: 999px;
	}

	.close-btn {
		background: #f1f5f9;
		border: none;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #475569;
		font-size: 1rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.close-btn:hover {
		background: #e2e8f0;
	}

	.guide-title {
		margin: 0.2rem 0;
		font-size: 1.5rem;
		font-weight: 900;
		color: #0f172a;
	}

	.guide-desc {
		margin: 0 0 1.2rem;
		font-size: 0.88rem;
		color: #64748b;
	}

	.lessons-scroll {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow-y: auto;
		padding-right: 0.5rem;
		margin-bottom: 1.2rem;
	}

	.lessons-scroll::-webkit-scrollbar {
		width: 6px;
	}

	.lessons-scroll::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 999px;
	}

	.lesson-card {
		background: #f8fafc;
		border: 1.5px solid #e2e8f0;
		border-radius: 16px;
		padding: 1.2rem;
	}

	.lesson-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
	}

	.lesson-badge {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.lesson-icon {
		font-size: 1.2rem;
	}

	.lesson-num {
		font-size: 0.72rem;
		font-weight: 800;
		color: #0284c7;
		letter-spacing: 0.08em;
	}

	.lesson-sub {
		font-size: 0.75rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
	}

	.lesson-heading {
		margin: 0 0 0.4rem;
		font-size: 1.05rem;
		font-weight: 800;
		color: #0f172a;
	}

	.lesson-summary {
		margin: 0 0 0.65rem;
		font-size: 0.84rem;
		line-height: 1.45;
		color: #334155;
	}

	.rules-box {
		background: #ffffff;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 0.75rem 0.9rem;
	}

	.rules-label {
		display: block;
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		color: #0369a1;
		margin-bottom: 0.35rem;
		letter-spacing: 0.05em;
	}

	.rules-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
		line-height: 1.4;
		color: #475569;
	}

	.guide-footer {
		display: flex;
		justify-content: flex-end;
		border-top: 1px solid #e2e8f0;
		padding-top: 1rem;
	}

	.btn-primary {
		padding: 0.7rem 1.6rem;
		border-radius: 10px;
		border: none;
		background: #0284c7;
		color: #ffffff;
		font-size: 0.92rem;
		font-weight: 800;
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-primary:hover {
		background: #0369a1;
	}
</style>
