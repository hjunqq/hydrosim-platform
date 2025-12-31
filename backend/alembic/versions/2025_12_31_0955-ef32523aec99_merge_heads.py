"""Merge heads

Revision ID: ef32523aec99
Revises: d5039572a91c, 1c2d3e4f5a6b
Create Date: 2025-12-31 09:55:36.108311

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef32523aec99'
down_revision: Union[str, None] = ('d5039572a91c', '1c2d3e4f5a6b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
