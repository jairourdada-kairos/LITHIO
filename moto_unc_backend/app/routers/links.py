"""Enlaces: amigos de viaje que forman tu molécula."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..links_service import bond_type, level_for, link_between, rides_together
from ..models import Link, User
from ..realtime import manager
from .. import push_service

router = APIRouter(prefix="/api/links", tags=["enlaces"])

MAX_LINKS = 50


class LinkRequestIn(BaseModel):
    code: str = Field(min_length=4, max_length=12)


def person(db: Session, me: User, other: User, link: Link) -> dict:
    level = level_for(other.fe_lifetime or 0)
    rides = rides_together(db, me.id, other.id)
    return {
        "link_id": link.id,
        "user_id": other.id,
        "name": other.name,
        "last_name": other.last_name,
        "avatar_url": other.avatar_url,
        "friend_code": other.friend_code,
        "element": {"z": level["z"], "symbol": level["symbol"], "name": level["name"]},
        "fe_lifetime": other.fe_lifetime or 0,
        "rides_together": rides,
        "bond": bond_type(rides),
    }


@router.get("")
def list_links(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    links = db.query(Link).filter(or_(Link.requester_id == me.id, Link.addressee_id == me.id)).all()
    accepted, incoming, outgoing = [], [], []
    for link in links:
        other_id = link.addressee_id if link.requester_id == me.id else link.requester_id
        other = db.get(User, other_id)
        if not other:
            continue
        item = person(db, me, other, link)
        if link.status == "aceptado":
            accepted.append(item)
        elif link.addressee_id == me.id:
            incoming.append(item)
        else:
            outgoing.append(item)
    accepted.sort(key=lambda item: item["fe_lifetime"], reverse=True)
    return {"my_code": me.friend_code, "links": accepted, "incoming": incoming, "outgoing": outgoing}


@router.post("", status_code=201)
async def request_link(data: LinkRequestIn, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    other = db.query(User).filter(func.upper(User.friend_code) == data.code.strip().upper()).first()
    if not other:
        raise HTTPException(status_code=404, detail="No encontramos a nadie con ese código.")
    if other.id == me.id:
        raise HTTPException(status_code=400, detail="Ese es tu propio código.")
    existing = link_between(db, me.id, other.id)
    if existing:
        if existing.status == "pendiente" and existing.addressee_id == me.id:
            # Ambos se buscaron: se acepta directamente.
            existing.status = "aceptado"
            db.commit()
            return person(db, me, other, existing)
        raise HTTPException(status_code=409, detail="Ya tienes un enlace o una solicitud con esta persona.")
    count = db.query(Link).filter(or_(Link.requester_id == me.id, Link.addressee_id == me.id)).count()
    if count >= MAX_LINKS:
        raise HTTPException(status_code=400, detail=f"Puedes tener hasta {MAX_LINKS} enlaces.")
    link = Link(requester_id=me.id, addressee_id=other.id, status="pendiente")
    db.add(link)
    db.commit()
    db.refresh(link)
    await manager.send_personal_message({"type": "LINK_REQUEST", "from": me.name, "link_id": link.id}, user_id=other.id)
    push_service.notify(db, other.id, "Nueva solicitud de enlace", f"{me.name} quiere ser tu enlace de viaje.", {"type": "LINK_REQUEST"})
    return person(db, me, other, link)


@router.post("/{link_id}/accept")
async def accept_link(link_id: int, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = db.get(Link, link_id)
    if not link or link.addressee_id != me.id:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    link.status = "aceptado"
    db.commit()
    await manager.send_personal_message({"type": "LINK_ACCEPTED", "by": me.name}, user_id=link.requester_id)
    push_service.notify(db, link.requester_id, "Enlace aceptado", f"{me.name} aceptó tu solicitud. Ya son enlaces.", {"type": "LINK_ACCEPTED"})
    return person(db, me, db.get(User, link.requester_id), link)


@router.delete("/{link_id}")
def remove_link(link_id: int, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = db.get(Link, link_id)
    if not link or me.id not in {link.requester_id, link.addressee_id}:
        raise HTTPException(status_code=404, detail="Enlace no encontrado.")
    db.delete(link)
    db.commit()
    return {"message": "Enlace eliminado"}
