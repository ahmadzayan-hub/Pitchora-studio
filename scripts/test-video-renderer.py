"""Fast validation regressions; no media tools needed."""
import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location("renderer", Path(__file__).resolve().parents[1] / "public/pitchora/render_video.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class TimelineTests(unittest.TestCase):
    def data(self):
        return {"format": "pitchora-motion-v1", "width": 1920, "height": 1080, "fps": 30, "scenes": [{"page": 1, "seconds": 2}]}
    def test_valid(self): self.assertEqual(len(module.validate_timeline(self.data())), 1)
    def test_nonfinite(self):
        for value in [float("nan"), float("inf"), -1, 0, True, "2"]:
            data = self.data(); data["scenes"][0]["seconds"] = value
            with self.assertRaises(ValueError): module.validate_timeline(data)
    def test_missing_page(self):
        data = self.data(); data["scenes"][0]["page"] = 7
        with self.assertRaises(ValueError): module.validate_timeline(data)
    def test_bounds(self):
        data = self.data(); data["scenes"] = [{"page": i + 1, "seconds": 120} for i in range(10)]
        with self.assertRaises(ValueError): module.validate_timeline(data)
    def test_codec_contract(self):
        data = self.data(); data["fps"] = 60
        with self.assertRaises(ValueError): module.validate_timeline(data)
if __name__ == "__main__": unittest.main()
