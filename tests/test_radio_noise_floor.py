import asyncio
from unittest.mock import patch

import pytest

from app.services import radio_noise_floor


class TestNoiseFloorSamplingLoop:
    @pytest.mark.asyncio
    async def test_logs_and_continues_after_unexpected_sample_exception(self):
        sample_calls = 0
        sleep_calls = 0

        async def fake_sample() -> None:
            nonlocal sample_calls
            sample_calls += 1
            if sample_calls == 1:
                raise RuntimeError("boom")

        async def fake_sleep(_seconds: int) -> None:
            nonlocal sleep_calls
            sleep_calls += 1
            if sleep_calls >= 2:
                raise asyncio.CancelledError()

        with (
            patch.object(radio_noise_floor, "sample_noise_floor_once", side_effect=fake_sample),
            patch.object(radio_noise_floor.asyncio, "sleep", side_effect=fake_sleep),
            patch.object(radio_noise_floor.logger, "exception") as mock_exception,
        ):
            with pytest.raises(asyncio.CancelledError):
                await radio_noise_floor._noise_floor_sampling_loop()

        assert sample_calls == 2
        assert sleep_calls == 2
        mock_exception.assert_called_once()
