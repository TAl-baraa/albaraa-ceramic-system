from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Future model modules should be imported here so Alembic can discover them.
