#!/usr/bin/env python3
import json
import sys
from PIL import Image, ImageChops, ImageStat


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: pixel-diff.py ACTUAL REFERENCE")

    actual = Image.open(sys.argv[1]).convert("RGB")
    reference = Image.open(sys.argv[2]).convert("RGB")
    if actual.size != reference.size:
        print(json.dumps({
            "comparable": False,
            "actualSize": list(actual.size),
            "referenceSize": list(reference.size),
            "normalizedMae": None,
        }))
        return

    difference = ImageChops.difference(actual, reference)
    means = ImageStat.Stat(difference).mean
    normalized_mae = sum(means) / (len(means) * 255)
    print(json.dumps({
        "comparable": True,
        "actualSize": list(actual.size),
        "referenceSize": list(reference.size),
        "normalizedMae": normalized_mae,
    }))


if __name__ == "__main__":
    main()
