"""
ALE v8.2 — routes/test.py 패치 가이드

기존 routes/test.py의 submit_test() 함수에서 각 문항 채점 루프 안에
디버그 로깅을 삽입합니다.

이 파일은 직접 실행하는 것이 아니라, 기존 test.py를 수정할 때 참고용입니다.
아래 코드를 기존 submit_test()의 for resp in responses: 루프 안에 삽입하세요.

═══ 수정 위치 (routes/test.py line ~76~118) ═══

기존:
    for resp in responses:
        item = await get_test_item(resp["item_id"])
        ...
        await save_test_response({...})
        results.append({...})

변경:
    for resp in responses:
        item = await get_test_item(resp["item_id"])

        # ▼▼▼ v8.2 디버그 로깅 시작 ▼▼▼
        debug = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "test_phase": test_phase,
            "item_id": resp["item_id"],
            "timestamp": time.time(),
            "learner_response": resp["response"],
            "item_type": item.get("item_type") if item else None,
            "question": item.get("question") if item else None,
        }
        t0 = time.monotonic()
        # ▲▲▲ v8.2 디버그 로깅 초기화 ▲▲▲

        ...기존 채점 로직...

        # ▼▼▼ v8.2 디버그 로깅 저장 ▼▼▼
        debug["elapsed_ms"] = int((time.monotonic() - t0) * 1000)
        debug["bloom_level"] = item.get("bloom_level", "remember") if item else "remember"
        try:
            from database_v82_patch import save_test_debug_log
            from database import get_db
            await save_test_debug_log(get_db, debug)
        except Exception as dbg_err:
            print(f"[DEBUG_LOG] 저장 실패: {dbg_err}")
        # ▲▲▲ v8.2 디버그 로깅 저장 ▲▲▲

        await save_test_response({...})
        results.append({...})

═══ MCQ 채점 시 debug 업데이트 ═══

    if item.get("item_type") == "mcq":
        score = 1.0 if resp["response"] == item.get("correct") else 0.0
        # v8.2
        debug["scoring_method"] = "mcq_exact"
        debug["auto_score"] = score
        debug["correct_answer"] = item.get("correct")

═══ 서술형 채점 시 debug 업데이트 ═══

    else:
        rubric = item.get("rubric")
        if isinstance(rubric, str):
            rubric = json.loads(rubric)
        if rubric:
            extraction = await extract_concepts(resp["response"], rubric)
            # v8.2
            debug["llm_raw_response"] = json.dumps(extraction, ensure_ascii=False)
            debug["correct_answer"] = json.dumps(rubric, ensure_ascii=False)

            from services.test_scorer import parse_concept_results
            parsed = parse_concept_results(extraction)
            debug["extraction_result"] = json.dumps(parsed, ensure_ascii=False)

            score_data = score_short_answer(extraction, rubric)
            score = score_data["score"]
            # v8.2
            debug["scoring_method"] = "binary_extraction"
            debug["auto_score"] = score
            debug["matched_count"] = score_data.get("matched_count")
            debug["total_count"] = score_data.get("total_count")
            debug["matched_keys"] = json.dumps(score_data.get("matched_keys", []))

═══ phase 종합 로그 (results 루프 후) ═══

    # v8.2: phase 종합 디버그 로그
    try:
        from database_v82_patch import save_test_debug_log
        from database import get_db
        await save_test_debug_log(get_db, {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "test_phase": test_phase,
            "item_id": "__PHASE_SUMMARY__",
            "timestamp": time.time(),
            "scoring_method": "phase_calculation",
            "auto_score": phase_score,
            "bloom_level": phase_bloom,
            "extraction_result": json.dumps({
                "individual_scores": {r["item_id"]: r["auto_score"] for r in results},
                "phase_score": phase_score,
                "phase_bloom": phase_bloom,
            }, ensure_ascii=False),
        })
    except Exception as dbg_err:
        print(f"[DEBUG_LOG] phase 종합 로그 저장 실패: {dbg_err}")
"""
