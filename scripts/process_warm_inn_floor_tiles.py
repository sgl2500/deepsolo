#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path

from build_floor_tileset_from_scene import ROOT, build_from_profile


PROFILE_PATH = ROOT / 'scripts' / 'floor_profiles' / 'warm_inn_observer_house.json'


def main() -> None:
    build_from_profile(PROFILE_PATH)


if __name__ == '__main__':
    main()
