from pydantic import BaseModel, ConfigDict, Field


class CardModel(BaseModel):
    id: str
    title: str
    details: str


class ColumnModel(BaseModel):
    id: str
    title: str
    card_ids: list[str] = Field(alias="cardIds")

    model_config = ConfigDict(populate_by_name=True)


class BoardModel(BaseModel):
    columns: list[ColumnModel]
    cards: dict[str, CardModel]

    model_config = ConfigDict(populate_by_name=True)
