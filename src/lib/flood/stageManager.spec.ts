import { describe, it, expect, beforeEach } from 'vitest';
import { Vector3 } from 'three';
import { createStageManager, STAGE_DEFINITIONS, STAGE_SAFETY_LESSONS } from './stageManager';
import { TrainingStateManager } from './trainingState';

describe('Flood Ready StageManager (6-Level Architecture)', () => {
	let trainingManager: TrainingStateManager;
	let stageManager: ReturnType<typeof createStageManager>;

	beforeEach(() => {
		trainingManager = new TrainingStateManager();
		stageManager = createStageManager(trainingManager);
	});

	it('should have exactly 6 substantial levels defined with safety lessons', () => {
		expect(STAGE_DEFINITIONS).toHaveLength(6);
		const stages = stageManager.getAllStages();
		expect(stages).toHaveLength(6);
		expect(stages.map((s) => s.stageNumber)).toEqual([1, 2, 3, 4, 5, 6]);
		for (let lvl = 1; lvl <= 6; lvl++) {
			expect(STAGE_SAFETY_LESSONS[lvl]).toBeDefined();
			expect(STAGE_SAFETY_LESSONS[lvl].length).toBeGreaterThan(20);
		}
	});

	it('should start at Level 1 with appropriate objectives', () => {
		const current = stageManager.getCurrentStage();
		expect(current.stageNumber).toBe(1);
		expect(current.id).toBe('early_warning');
		expect(current.primaryObjectives.length).toBeGreaterThan(0);
	});

	it('should complete Level 1 when Level 1 objectives are met, pause for modal, and advance to Level 2 on continue', () => {
		trainingManager.completeStageObjective('s1_warning_board');
		trainingManager.completeStageObjective('s1_evac_map');
		trainingManager.completeStageObjective('s1_water_gauge');
		trainingManager.completeStageObjective('s1_whistle');
		trainingManager.completeStageObjective('stage1_flood_warning');
		trainingManager.completeStageObjective('s1_advance_gate');

		const res = stageManager.checkProgression(
			new Vector3(-17, 0, 0),
			0.5,
			0.2,
			1,
			15.0
		);

		expect(res.levelCompleted).toBe(true);
		expect(res.isFinalLevel).toBe(false);
		expect(res.safetyLesson).toBe(STAGE_SAFETY_LESSONS[1]);

		// Advances cleanly to Level 2 on continue
		const newStg = stageManager.advanceStage();
		expect(newStg.stageNumber).toBe(2);
		expect(newStg.id).toBe('community_triage');
	});

	it('PRIORITY FIX: should complete Level 2 and advance cleanly to Level 3 without game breaks or hidden stalls', () => {
		stageManager.setStage(2);
		expect(stageManager.getCurrentStage().stageNumber).toBe(2);

		trainingManager.completeStageObjective('s2_check_prashant');
		trainingManager.completeStageObjective('s2_check_manvi');
		trainingManager.completeStageObjective('s2_check_shivani');
		trainingManager.completeStageObjective('s2_bulletin');
		trainingManager.completeStageObjective('scenario_a_blocked_route');
		trainingManager.completeStageObjective('s2_reach_trailhead');

		const res = stageManager.checkProgression(
			new Vector3(-12, 0, 0),
			1.2,
			0.6,
			3,
			15.0
		);

		expect(res.levelCompleted).toBe(true);
		expect(res.isFinalLevel).toBe(false);
		expect(res.safetyLesson).toBe(STAGE_SAFETY_LESSONS[2]);

		const newStg = stageManager.advanceStage();
		expect(newStg.stageNumber).toBe(3);
		expect(newStg.id).toBe('route_selection');
		expect(stageManager.getCurrentStage().stageNumber).toBe(3);
	});

	it('should complete Level 3 and advance to Level 4 when safe route is chosen', () => {
		stageManager.setStage(3);

		trainingManager.completeStageObjective('s3_inspect_route_a');
		trainingManager.completeStageObjective('s3_inspect_route_b');
		trainingManager.completeStageObjective('s3_first_aid');
		trainingManager.completeStageObjective('s3_submerged_sign');
		trainingManager.completeStageObjective('stage3_route_choice');
		trainingManager.completeStageObjective('s3_reach_elevation');

		const res = stageManager.checkProgression(
			new Vector3(-5, 1.8, 0),
			1.8,
			0.8,
			3,
			15.0
		);

		expect(res.levelCompleted).toBe(true);
		expect(res.isFinalLevel).toBe(false);

		const newStg = stageManager.advanceStage();
		expect(newStg.stageNumber).toBe(4);
		expect(newStg.id).toBe('electrical_hazard');
	});

	it('should progress smoothly from Level 4 to Level 5 and Level 6, and finalize simulation on Level 6', () => {
		stageManager.setStage(4);
		trainingManager.completeStageObjective('s4_inspect_junction');
		trainingManager.completeStageObjective('s4_inspect_downed_line');
		trainingManager.completeStageObjective('s4_flashlight');
		trainingManager.completeStageObjective('s4_assist_shruti');
		trainingManager.completeStageObjective('scenario_b_electrical_hazard');
		trainingManager.completeStageObjective('s4_detour_clear');

		let res = stageManager.checkProgression(new Vector3(4, 3.2, 0), 3.2, 1.2, 4, 15.0);
		expect(res.levelCompleted).toBe(true);
		expect(res.isFinalLevel).toBe(false);
		let nextStg = stageManager.advanceStage();
		expect(nextStg.stageNumber).toBe(5);

		trainingManager.completeStageObjective('s5_assist_prashanthi');
		trainingManager.completeStageObjective('s5_assist_anuj');
		trainingManager.completeStageObjective('s5_drinking_water');
		trainingManager.completeStageObjective('scenario_c_building_inundation');
		trainingManager.completeStageObjective('s5_reach_plateau');

		res = stageManager.checkProgression(new Vector3(19, 5.0, 4), 5.0, 1.8, 6, 16.0);
		expect(res.levelCompleted).toBe(true);
		expect(res.isFinalLevel).toBe(false);
		nextStg = stageManager.advanceStage();
		expect(nextStg.stageNumber).toBe(6);
		expect(nextStg.id).toBe('summit_command');

		// Level 6: Summit evacuation complete
		trainingManager.completeStageObjective('s6_report_flood');
		trainingManager.completeStageObjective('s6_report_electrical');
		trainingManager.completeStageObjective('s6_report_roster');
		trainingManager.completeStageObjective('s6_check_radio');
		trainingManager.completeStageObjective('s6_helipad_triage');
		trainingManager.completeStageObjective('stage10_final_evacuation');
		trainingManager.completeStageObjective('s6_climb_summit');

		res = stageManager.checkProgression(new Vector3(28, 8.5, 18), 8.5, 2.5, 8, 20.0);
		expect(res.levelCompleted).toBe(true);
		expect(res.isFinalLevel).toBe(true);
		expect(trainingManager.getState().isCompleted).toBe(true);
	});
});
