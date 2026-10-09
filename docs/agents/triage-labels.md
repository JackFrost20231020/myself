# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `待分类`             | Maintainer needs to evaluate this issue  |
| `needs-info`               | `待补充`             | Waiting on reporter for more information |
| `ready-for-agent`          | `交给智能体`         | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `需要人工`           | Requires human implementation            |
| `wontfix`                  | `不做`               | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

These labels may not exist in the GitHub repo yet. Before applying one for the first time, create it with `gh label create "<label>"`.

Edit the right-hand column to match whatever vocabulary you actually use.
