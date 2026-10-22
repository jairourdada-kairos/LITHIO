"""Deprecated seeder for the retired root-level backend."""


def seed_data() -> None:
    raise RuntimeError(
        "The root-level backend is retired. Initialize data with "
        "moto_unc_backend/app/seed.py and configure Firebase authentication."
    )


if __name__ == "__main__":
    seed_data()
