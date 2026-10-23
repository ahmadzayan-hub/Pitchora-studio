#!/usr/bin/env python3
"""Render the reviewed Pitchora package locally. No uploads, installs or model calls."""
import argparse
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile


def command(args, timeout=300):
    result = subprocess.run(args, check=True, capture_output=True, timeout=timeout)
    return result.stdout


def probe(path):
    return json.loads(command(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]))


def validate_timeline(data):
    if data.get("format") != "pitchora-motion-v1" or data.get("fps") != 30:
        raise ValueError("Unsupported timeline format")
    if (data.get("width"), data.get("height")) not in [(1920, 1080), (1080, 1920)]:
        raise ValueError("Choose 1920x1080 or 1080x1920")
    scenes = data.get("scenes")
    if not isinstance(scenes, list) or not 1 <= len(scenes) <= 30:
        raise ValueError("Expected 1–30 scenes")
    for i, scene in enumerate(scenes):
        if scene.get("page") != i + 1:
            raise ValueError("Pages must be sequential and complete")
        seconds = scene.get("seconds")
        if isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or not math.isfinite(seconds) or not 2 <= seconds <= 120:
            raise ValueError("Each scene must be 2–120 seconds")
    if sum(s["seconds"] for s in scenes) > 600:
        raise ValueError("Maximum timeline is ten minutes")
    return scenes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio", type=Path, help="Existing local narration file, not a URL")
    parser.add_argument("--fit-audio", action="store_true", help="Scale manual cues to measured narration duration; NOT speech alignment")
    args = parser.parse_args()
    root = Path.cwd()
    output = root / "output.mp4"
    if output.exists():
        raise ValueError("output.mp4 already exists. Move it before rendering; nothing was overwritten.")
    for tool in ["soffice", "pdftoppm", "ffmpeg", "ffprobe"]:
        if not shutil.which(tool):
            raise ValueError(f"Missing {tool}. Install from its official project or operating-system package manager.")
    if (root / "timeline.json").stat().st_size > 100_000 or (root / "deck.pptx").stat().st_size > 50_000_000:
        raise ValueError("Package exceeds safe input size limits")
    data = json.loads((root / "timeline.json").read_text(encoding="utf-8"))
    scenes = validate_timeline(data)
    seconds = [float(s["seconds"]) for s in scenes]
    audio_duration = None
    if args.audio:
        args.audio = args.audio.resolve(strict=True)
        if not args.audio.is_file() or args.audio.stat().st_size > 200_000_000:
            raise ValueError("Narration must be a local file under 200 MB")
        info = probe(args.audio)
        if not any(s.get("codec_type") == "audio" for s in info["streams"]):
            raise ValueError("Narration contains no audio stream")
        audio_duration = float(info["format"]["duration"])
        if not math.isfinite(audio_duration) or not 0 < audio_duration <= 600:
            raise ValueError("Narration duration must be under ten minutes")
        if args.fit_audio:
            seconds = [s * audio_duration / sum(seconds) for s in seconds]
            if min(seconds) < 2:
                raise ValueError("Narration too short for readable scenes; edit the storyboard")
        elif abs(sum(seconds) - audio_duration) > 1 / 30:
            raise ValueError("Manual cues do not match narration duration. Edit timeline or explicitly choose --fit-audio.")
    elif args.fit_audio:
        raise ValueError("--fit-audio needs --audio")
    duration = math.ceil(sum(seconds) * 30) / 30
    width, height = data["width"], data["height"]
    with tempfile.TemporaryDirectory(prefix="pitchora-render-") as temp:
        temp = Path(temp)
        shutil.copyfile(root / "deck.pptx", temp / "deck.pptx")
        profile = (temp / "lo-profile").as_uri()
        command(["soffice", f"-env:UserInstallation={profile}", "--headless", "--convert-to", "pdf", "--outdir", str(temp), str(temp / "deck.pptx")])
        command(["pdftoppm", "-f", "1", "-l", str(len(scenes) + 1), "-png", "-scale-to", "1920", str(temp / "deck.pdf"), str(temp / "page")])
        pages = sorted(temp.glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
        if len(pages) != len(scenes):
            raise ValueError("Slide count differs from timeline. Rendering stopped.")
        # Paths are generated locally, not interpolated from project content.
        concat = temp / "frames.txt"
        entries = []
        for page, hold in zip(pages, seconds):
            entries.extend([f"file '{page.as_posix()}'", f"duration {hold:.9f}"])
        entries.append(f"file '{pages[-1].as_posix()}'")
        concat.write_text("\n".join(entries), encoding="utf-8")
        rendered = temp / "rendered.mp4"
        cmd = ["ffmpeg", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(concat)]
        if args.audio:
            cmd += ["-i", str(args.audio), "-map", "0:v:0", "-map", "1:a:0", "-af", "apad", "-c:a", "aac", "-ar", "48000"]
        else:
            cmd += ["-an"]
        cmd += ["-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=0x0a0e2a,fps=30,format=yuv420p", "-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "18", "-t", str(duration), "-movflags", "+faststart", str(rendered)]
        command(cmd, timeout=1800)
        output_info = probe(rendered)
        video = next(s for s in output_info["streams"] if s.get("codec_type") == "video")
        actual = float(output_info["format"]["duration"])
        if video.get("codec_name") != "h264" or video.get("pix_fmt") != "yuv420p" or video.get("r_frame_rate") != "30/1" or (video.get("width"), video.get("height")) != (width, height) or abs(actual - duration) > .1:
            raise ValueError("Output codec, frame rate, dimensions or duration failed verification")
        if args.audio:
            audio = next(s for s in output_info["streams"] if s.get("codec_type") == "audio")
            if audio.get("codec_name") != "aac" or audio.get("sample_rate") != "48000" or actual + .01 < audio_duration:
                raise ValueError("Narration output verification failed")
        # Exclusive create prevents overwriting if another render finished meanwhile.
        with output.open("xb") as target, rendered.open("rb") as source:
            shutil.copyfileobj(source, target)
        (root / "render-report.json").write_text(json.dumps({"duration_seconds": actual, "measured_narration_seconds": audio_duration, "scene_count": len(scenes), "timing": "manual_cues_not_speech_alignment", "narration": "original_file" if args.audio else "none", "motion": "held_slides_no_generated_animation", "checks": "codec_dimensions_duration_only", "human_review_required": ["full playback with sound", "Arabic shaping", "readability", "source meaning", "no clipped text"]}, indent=2), encoding="utf-8")
    print("Created and technically verified output.mp4. Full visual/audio review is still required.")


if __name__ == "__main__":
    main()
