from app.audio import MAX_PART_S, plan_parts


def lengths(parts):
    return [round(end - start, 2) for start, end in parts]


def test_short_recording_is_one_part():
    assert plan_parts(20.0, []) == [(0.0, 20.0)]


def test_no_pauses_means_hard_cuts_at_the_limit():
    parts = plan_parts(70.0, [])
    assert lengths(parts) == [28.0, 28.0, 14.0]


def test_cuts_at_the_last_pause_before_the_limit():
    pauses = [7.5 + 8 * i for i in range(10)]
    parts = plan_parts(80.0, pauses)
    assert [end for _, end in parts[:-1]] == [23.5, 47.5, 71.5]


def test_ignores_pauses_too_close_to_the_start():
    parts = plan_parts(40.0, [3.0, 20.0])
    assert parts[0] == (0.0, 20.0)


def test_every_part_fits_gnanis_limit():
    pauses = [5.0, 31.0, 33.0, 90.0, 140.0]
    parts = plan_parts(300.0, pauses)
    assert all(end - start <= MAX_PART_S + 0.5 for start, end in parts)
    assert parts[0][0] == 0.0 and parts[-1][1] == 300.0
    assert all(a[1] == b[0] for a, b in zip(parts, parts[1:]))


def test_tiny_leftover_is_merged():
    parts = plan_parts(28.3, [])
    assert parts == [(0.0, 28.3)]
