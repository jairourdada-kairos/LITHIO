"""Preguntas de la Reacción del día sobre las carreras de la Universidad Nacional de las Ciencias (UNC).

Cada pregunta es (pregunta, tres opciones, índice de la correcta, dato curioso).
Los temas salen de las carreras de pregrado que la UNC publica en su sitio:
Nanotecnología, Inteligencia Artificial, Ciberseguridad, Oceanología, Ciencia de Datos y Filosofía.
"""

NANOTECNOLOGIA = [
    ("¿En qué escala trabaja la nanotecnología?",
     ["Milésimas de metro (milímetros)", "Millonésimas de metro (micras)", "Milmillonésimas de metro (nanómetros)"], 2,
     "Un nanómetro es la milmillonésima parte de un metro."),
    ("¿Qué es el grafeno?",
     ["Una capa de átomos de carbono de un solo átomo de grosor", "Una aleación de hierro y níquel", "Un plástico derivado del petróleo"], 0,
     "Andre Geim y Konstantin Novoselov ganaron el Nobel de Física 2010 por aislarlo."),
    ("¿Qué físico habló en 1959 de manipular átomos en su charla «Hay mucho espacio al fondo»?",
     ["Richard Feynman", "Albert Einstein", "Niels Bohr"], 0,
     "Se le considera quien imaginó la nanotecnología mucho antes de poder hacerla."),
    ("¿Qué instrumento, creado en los años 80, permitió ver y mover átomos individuales?",
     ["Microscopio de efecto túnel", "Telescopio refractor", "Espectrómetro de masas"], 0,
     "Binnig y Rohrer lo inventaron en 1981 y recibieron el Nobel de Física en 1986."),
    ("¿Qué le pasa a un material cuando se reduce a escala nanométrica?",
     ["Sus propiedades nunca cambian", "Puede cambiar su color, su reactividad o su conductividad", "Siempre se vuelve magnético"], 1,
     "Las nanopartículas de oro se ven rojas o violetas, no doradas."),
    ("¿Cuánto mide, aproximadamente, el grosor de un cabello humano?",
     ["80 nanómetros", "80.000 nanómetros", "80.000.000 nanómetros"], 1,
     "Unos 80 micrómetros: en un cabello caben decenas de miles de nanómetros."),
]

INTELIGENCIA_ARTIFICIAL = [
    ("¿Qué es un LLM?",
     ["Un modelo de lenguaje entrenado con enormes cantidades de texto", "Un lenguaje de programación para robots", "Un tipo de memoria de computadora"], 0,
     "LLM significa Large Language Model: aprende a predecir la siguiente palabra de un texto."),
    ("¿Qué es el aprendizaje supervisado?",
     ["Aprender con ejemplos que ya traen la respuesta correcta", "Aprender sin ningún dato", "Que una persona revise cada cálculo en vivo"], 0,
     "Por ejemplo, miles de fotos etiquetadas como «gato» o «perro»."),
    ("¿Qué arquitectura, presentada en 2017 en el artículo «Attention Is All You Need», sostiene a los LLM actuales?",
     ["El Transformer", "El perceptrón simple", "La máquina de Turing"], 0,
     "Su mecanismo de atención permite relacionar cada palabra con todas las demás del texto."),
    ("¿Qué área de la IA permite que una computadora interprete imágenes y video?",
     ["Visión por computadora", "Criptografía", "Computación cuántica"], 0,
     "Se usa desde en el desbloqueo facial hasta en el diagnóstico por imágenes médicas."),
    ("¿Quién propuso en 1950 una prueba para decidir si una máquina puede pensar?",
     ["Alan Turing", "John von Neumann", "Claude Shannon"], 0,
     "Su «juego de la imitación» hoy se conoce como la prueba de Turing."),
    ("¿Cómo se llama cuando un modelo de IA inventa datos falsos con aparente seguridad?",
     ["Alucinación", "Compilación", "Fragmentación"], 0,
     "Por eso conviene verificar lo que responde una IA con fuentes confiables."),
]

CIBERSEGURIDAD = [
    ("¿Qué es el phishing?",
     ["Engañar a alguien para que entregue sus datos o claves", "Un virus que borra el disco duro", "Un tipo de firewall"], 0,
     "Suele llegar como un correo o mensaje falso que imita a un banco o a una red social."),
    ("¿Para qué sirve un firewall?",
     ["Para filtrar el tráfico de red según reglas", "Para acelerar el internet", "Para cifrar el disco duro"], 0,
     "Decide qué conexiones entran y salen de una red o de un equipo."),
    ("¿Qué es la autenticación de dos factores (2FA)?",
     ["Pedir dos pruebas distintas de identidad, como la clave y un código del teléfono", "Usar dos veces la misma contraseña", "Tener dos cuentas con el mismo correo"], 0,
     "Aunque alguien robe tu clave, sin el segundo factor no puede entrar."),
    ("¿Qué garantiza el cifrado de extremo a extremo?",
     ["Que solo quien envía y quien recibe pueden leer el mensaje", "Que el servidor lea y guarde todo", "Que el mensaje llegue más rápido"], 0,
     "Ni siquiera la empresa que transporta el mensaje puede leerlo."),
    ("¿Qué hace una VPN?",
     ["Cifra tu conexión y la envía por un túnel privado", "Elimina virus del equipo", "Crea contraseñas automáticamente"], 0,
     "VPN significa red privada virtual."),
    ("¿Qué es un ataque de ransomware?",
     ["Cifra tus archivos y pide un pago para devolverlos", "Roba solamente fotos", "Apaga la pantalla del equipo"], 0,
     "La mejor defensa son las copias de seguridad hechas con anticipación."),
]

OCEANOLOGIA = [
    ("¿Qué porcentaje de la superficie de la Tierra cubren los océanos?",
     ["Cerca del 71 %", "Cerca del 50 %", "Cerca del 90 %"], 0,
     "Por eso al planeta se le llama «el planeta azul»."),
    ("¿Cuál es el océano más grande del mundo?",
     ["Pacífico", "Atlántico", "Índico"], 0,
     "Cubre más superficie que todas las tierras emergidas juntas."),
    ("¿Qué causa principalmente las mareas?",
     ["La atracción gravitatoria de la Luna y del Sol", "Los vientos alisios", "Las corrientes de los ríos"], 0,
     "La Luna, por estar más cerca, pesa más que el Sol en las mareas."),
    ("¿Qué estudia la oceanografía biológica?",
     ["La vida marina y sus ecosistemas", "Solo la forma de las olas", "La composición del fondo rocoso"], 0,
     "Incluye desde el plancton microscópico hasta las ballenas."),
    ("¿Qué es la salinidad del mar?",
     ["La cantidad de sales disueltas en el agua", "La temperatura del agua", "La profundidad del fondo"], 0,
     "En promedio, el océano tiene unos 35 gramos de sal por cada litro."),
    ("¿Qué ecosistema formado por pólipos abunda en el archipiélago de Los Roques?",
     ["Arrecifes de coral", "Glaciares marinos", "Desiertos de arena negra"], 0,
     "Los arrecifes protegen la costa y albergan gran parte de la vida marina."),
    ("¿Cuánta profundidad tiene, aproximadamente, la Fosa de las Marianas, el punto más profundo conocido?",
     ["Cerca de 11.000 metros", "Cerca de 3.000 metros", "Cerca de 500 metros"], 0,
     "Si pusieras el Everest en el fondo, su cima quedaría a más de 2 km bajo el agua."),
]

CIENCIA_DE_DATOS = [
    ("¿Qué es un dataset?",
     ["Un conjunto organizado de datos para analizar", "Un lenguaje de programación", "Un chip de computadora"], 0,
     "Puede ser una tabla de viajes, de encuestas, de sensores, etc."),
    ("¿Cómo se calcula el promedio (media aritmética)?",
     ["Sumando los valores y dividiendo entre cuántos son", "Tomando el valor que más se repite", "Tomando el valor del medio"], 0,
     "El valor que más se repite es la moda; el del medio, la mediana."),
    ("¿Qué lenguaje de programación es de los más usados en ciencia de datos?",
     ["Python", "Cobol", "Ensamblador"], 0,
     "Sus librerías pandas, NumPy y scikit-learn son estándar del oficio."),
    ("¿Para qué sirve visualizar los datos con gráficos?",
     ["Para encontrar patrones y comunicar resultados", "Para borrarlos", "Para cifrarlos"], 0,
     "Un buen gráfico muestra en segundos lo que una tabla esconde."),
    ("¿Qué es el sobreajuste (overfitting) de un modelo?",
     ["Memoriza los datos de entrenamiento y falla con datos nuevos", "Es demasiado rápido", "Le faltan datos de prueba"], 0,
     "Por eso los datos se separan en entrenamiento y prueba."),
    ("¿Qué es la mediana?",
     ["El valor central de los datos ordenados", "La suma de todos los datos", "El valor máximo"], 0,
     "No la afectan los valores extremos, por eso se usa para sueldos y precios de vivienda."),
]

FILOSOFIA = [
    ("¿Qué autor desarrolló el concepto de epistemicidio?",
     ["Boaventura de Sousa Santos", "Immanuel Kant", "Friedrich Nietzsche"], 0,
     "Lo usa para hablar de la destrucción de los saberes de los pueblos colonizados (Epistemologías del Sur)."),
    ("¿Quién escribió «Crítica de la razón pura»?",
     ["Immanuel Kant", "Aristóteles", "Karl Marx"], 0,
     "Publicada en 1781, buscó los límites de lo que la razón puede conocer."),
    ("¿Quién dijo «pienso, luego existo»?",
     ["René Descartes", "Platón", "David Hume"], 0,
     "Lo planteó como la primera certeza de la que no podía dudar."),
    ("¿Cómo se llama la rama de la filosofía que estudia el conocimiento?",
     ["Epistemología", "Estética", "Ética"], 0,
     "Se pregunta qué es conocer, cómo conocemos y cuándo algo está justificado."),
    ("¿Quién fue el maestro de Platón?",
     ["Sócrates", "Pitágoras", "Heráclito"], 0,
     "Sócrates no escribió nada: lo conocemos sobre todo por los diálogos de Platón."),
    ("¿Qué rama de la filosofía estudia lo que está bien y lo que está mal?",
     ["Ética", "Lógica", "Metafísica"], 0,
     "Es una de las ramas centrales del plan de estudios de cualquier carrera de filosofía."),
    ("¿Qué filósofo y educador fue el maestro de Simón Bolívar?",
     ["Simón Rodríguez", "Andrés Bello", "Francisco de Miranda"], 0,
     "Simón Rodríguez firmaba con el seudónimo «Samuel Robinson»."),
]

UNC = [
    ("¿Cuántos años dura una carrera de pregrado en la UNC?",
     ["4 años (8 semestres)", "3 años (6 semestres)", "6 años (12 semestres)"], 0,
     "Las carreras de pregrado de la UNC tienen entre 180 y 191 unidades de crédito."),
    ("¿En qué estado queda la sede de la Universidad Nacional de las Ciencias?",
     ["Miranda", "Mérida", "Zulia"], 0,
     "Su sede está en la carretera Panamericana, en Altos de Pipe."),
]

BANCOS = [NANOTECNOLOGIA, INTELIGENCIA_ARTIFICIAL, CIBERSEGURIDAD, OCEANOLOGIA, CIENCIA_DE_DATOS, FILOSOFIA, UNC]
