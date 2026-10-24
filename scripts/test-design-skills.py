#!/usr/bin/env python3
"""Offline integrity checks for the two explicitly selected text-only skills."""
import hashlib
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / '.agents' / 'skills'


class DesignSkillTests(unittest.TestCase):
    def test_exact_skill_set_and_metadata(self):
        entries = sorted(SKILLS.glob('*/SKILL.md'))
        self.assertEqual([p.parent.name for p in entries],
                         ['emil-design-eng', 'review-animations'])
        for entry in entries:
            text = entry.read_text()
            self.assertTrue(text.startswith('---\n'))
            metadata = text.split('---', 2)[1]
            self.assertRegex(metadata, rf'(?m)^name: {entry.parent.name}$')
            self.assertRegex(metadata, r'(?m)^description: .+')
            self.assertIn('disable-model-invocation: true', metadata)
            self.assertIn('project-scoped adapter', text)
            self.assertIn('Reduced motion may mean **no animation**', text)

    def test_pinned_sources_and_complete_notices(self):
        entries = json.loads((SKILLS / 'provenance.json').read_text())
        self.assertEqual({e['name'] for e in entries},
                         {'emil-design-eng', 'review-animations'})
        for entry in entries:
            self.assertEqual(entry['repository'], 'https://github.com/emilkowalski/skills')
            self.assertEqual(entry['commit'], '2d228630ba1446365f614a108cb8252f1feda202')
            self.assertEqual(entry['license'], 'MIT')
            self.assertIn('LICENSE', entry['copied_files_sha256'])
            self.assertIn('UPSTREAM-SKILL.md', entry['copied_files_sha256'])
            for name, expected in entry['copied_files_sha256'].items():
                self.assertEqual(Path(name).name, name)
                actual = hashlib.sha256((SKILLS / entry['name'] / name).read_bytes()).hexdigest()
                self.assertEqual(actual, expected, f'{entry["name"]}/{name}')
            license_text = (SKILLS / entry['name'] / 'LICENSE').read_text()
            self.assertIn('MIT License', license_text)
            self.assertIn('Copyright', license_text)
            self.assertIn('Permission is hereby granted', license_text)
            self.assertIn('THE SOFTWARE IS PROVIDED "AS IS"', license_text)

    def test_local_markdown_references(self):
        paths = [ROOT / 'AGENTS.md', ROOT / 'docs/DESIGN_GUIDE.md',
                 *SKILLS.rglob('*.md')]
        for path in paths:
            for target in re.findall(r'\[[^\]]*\]\(([^)\s]+)\)', path.read_text()):
                if target.startswith(('https://', 'http://', '#', 'mailto:')):
                    continue
                target = target.split('#', 1)[0]
                self.assertTrue((path.parent / target).resolve().exists(),
                                f'Broken reference: {path.relative_to(ROOT)} -> {target}')

    def test_text_only_and_no_runtime_dependency(self):
        allowed = {'.md', '.json'}
        for path in SKILLS.rglob('*'):
            if path.is_file():
                self.assertFalse(path.is_symlink())
                self.assertTrue(path.suffix in allowed or path.name == 'LICENSE', str(path))
        package = json.loads((ROOT / 'package.json').read_text())
        for group in ('dependencies', 'devDependencies'):
            self.assertNotIn('gsap', package.get(group, {}))
            self.assertNotIn('@gsap/react', package.get(group, {}))
        self.assertTrue((SKILLS / 'review-animations/STANDARDS.md').is_file())


if __name__ == '__main__':
    unittest.main(verbosity=2)
