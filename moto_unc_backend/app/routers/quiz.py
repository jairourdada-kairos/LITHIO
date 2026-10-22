"""Reacción del día: una pregunta de ciencia diaria que da Fe al acertar."""
import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import VENEZUELA_TZ
from ..database import get_db
from ..links_service import award_fe
from ..models import QuizAnswer, User

router = APIRouter(prefix="/api/quiz", tags=["reacción del día"])

FE_REWARD = 10

# (pregunta, opciones, índice correcto, dato curioso)
QUESTIONS = [
    ("¿Qué elemento tiene número atómico 3?", ["Litio", "Helio", "Boro"], 0,
     "El litio es el metal más ligero de la tabla periódica."),
    ("¿Qué gas necesitamos respirar para vivir?", ["Dióxido de carbono", "Oxígeno", "Nitrógeno"], 1,
     "El aire es 21 % oxígeno y 78 % nitrógeno."),
    ("¿Cuál es la fórmula química del agua?", ["H₂O₂", "HO", "H₂O"], 2,
     "Cada molécula de agua tiene dos átomos de hidrógeno y uno de oxígeno."),
    ("¿Qué partícula del átomo tiene carga negativa?", ["Electrón", "Protón", "Neutrón"], 0,
     "En LITHIO los pasajeros son electrones: siempre en movimiento."),
    ("¿Qué planeta es conocido como el planeta rojo?", ["Venus", "Marte", "Júpiter"], 1,
     "Su color viene del óxido de hierro de su superficie."),
    ("¿Cuál es la unidad de medida de la fuerza?", ["Joule", "Watt", "Newton"], 2,
     "Un newton acelera 1 kg a 1 m/s²."),
    ("¿Qué orgánulo produce la energía de la célula?", ["Mitocondria", "Ribosoma", "Núcleo"], 0,
     "Las mitocondrias tienen su propio ADN."),
    ("¿Qué símbolo químico tiene el hierro?", ["Hi", "Fe", "Ir"], 1,
     "Viene del latín ferrum. ¡Por eso tus recompensas se llaman Fe!"),
    ("¿A qué velocidad viaja la luz en el vacío, aproximadamente?", ["30.000 km/s", "3.000 km/s", "300.000 km/s"], 2,
     "La luz del Sol tarda unos 8 minutos en llegar a la Tierra."),
    ("¿Qué gas emiten las plantas en la fotosíntesis?", ["Oxígeno", "Metano", "Hidrógeno"], 0,
     "Las plantas toman CO₂ y liberan O₂ usando la luz solar."),
    ("¿Cuál es el pH del agua pura a 25 °C?", ["5", "7", "9"], 1,
     "Por debajo de 7 es ácido y por encima es básico."),
    ("¿Qué científica ganó dos premios Nobel en ciencias distintas?", ["Rosalind Franklin", "Ada Lovelace", "Marie Curie"], 2,
     "Marie Curie ganó en Física (1903) y en Química (1911)."),
    ("¿Qué elemento es el más abundante en el universo?", ["Hidrógeno", "Oxígeno", "Carbono"], 0,
     "Cerca del 74 % de la materia normal del universo es hidrógeno."),
    ("¿Cuántos cromosomas tiene una célula humana típica?", ["23", "46", "64"], 1,
     "Son 23 pares: la mitad viene de cada progenitor."),
    ("¿Qué tipo de energía tiene una moto en movimiento?", ["Potencial", "Nuclear", "Cinética"], 2,
     "La energía cinética crece con el cuadrado de la velocidad: frena a tiempo."),
    ("¿Qué gas noble se usa en los letreros luminosos rojos?", ["Neón", "Argón", "Kriptón"], 0,
     "Cada gas noble brilla con un color distinto al pasar corriente."),
    ("¿Cuál es el hueso más largo del cuerpo humano?", ["Húmero", "Fémur", "Tibia"], 1,
     "El fémur mide cerca de un cuarto de la estatura de una persona."),
    ("¿Qué metal es líquido a temperatura ambiente?", ["Plomo", "Estaño", "Mercurio"], 2,
     "El mercurio se funde a −39 °C."),
    ("¿Qué ley dice que a toda acción corresponde una reacción?", ["Tercera ley de Newton", "Ley de Ohm", "Ley de Boyle"], 0,
     "Por eso el casco y la postura importan al frenar en moto."),
    ("¿En qué unidad se mide la resistencia eléctrica?", ["Voltio", "Ohmio", "Amperio"], 1,
     "Lleva el nombre del físico Georg Ohm."),
    ("¿Qué molécula guarda la información genética?", ["ATP", "ARN de transferencia", "ADN"], 2,
     "Si estiraras el ADN de una célula humana mediría unos 2 metros."),
]


class AnswerIn(BaseModel):
    option: int = Field(ge=0, le=2)


def venezuela_today():
    return datetime.now(VENEZUELA_TZ).date()


def question_for(day) -> tuple:
    """Pregunta del día con las opciones barajadas: la respuesta no sigue un patrón."""
    question, options, correct, fact = QUESTIONS[day.toordinal() % len(QUESTIONS)]
    order = list(range(len(options)))
    random.Random(day.toordinal()).shuffle(order)
    return question, [options[i] for i in order], order.index(correct), fact


@router.get("/today")
def today(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    day = venezuela_today()
    question, options, correct, fact = question_for(day)
    answer = db.query(QuizAnswer).filter(QuizAnswer.user_id == user.id, QuizAnswer.quiz_date == day).first()
    payload = {"date": day.isoformat(), "question": question, "options": options, "reward": FE_REWARD, "answered": answer is not None}
    if answer:
        payload.update({"chosen": answer.option_index, "correct": answer.correct, "correct_index": correct, "fact": fact})
    return payload


@router.post("/today")
def answer_today(data: AnswerIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    day = venezuela_today()
    question, options, correct, fact = question_for(day)
    is_correct = data.option == correct
    db.add(QuizAnswer(user_id=user.id, quiz_date=day, option_index=data.option, correct=is_correct))
    if is_correct:
        award_fe(user, FE_REWARD)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya respondiste la Reacción de hoy. Vuelve mañana.")
    return {
        "correct": is_correct,
        "correct_index": correct,
        "fact": fact,
        "fe_awarded": FE_REWARD if is_correct else 0,
        "points": user.points,
    }
