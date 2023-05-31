from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from jose import JWTError, jwt, jwk
from passlib.context import CryptContext
from pydantic import BaseModel

import sqlalchemy
from db_connect import connect_with_connector

from google.cloud import storage
from google.cloud import texttospeech

import base64
import os
import time
import json

from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

# Allow CORS
origins = [
    "https://cs683-audiobooks.appspot.com",
    "https://cs683-audiobooks.ey.r.appspot.com",
    "https://app-dot-cs683-audiobooks.ey.r.appspot.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    #allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

with open('private.pem', 'r') as f:
    JWT_PRIVATE_KEY = f.read()
with open('public.pem', 'r') as f:
    JWT_PUBLIC_KEY = f.read()
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM')
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRE_MINUTES'))
BUCKET_NAME = os.getenv('BUCKET_NAME')

book_cache = {}

private_key = jwk.construct(JWT_PRIVATE_KEY, JWT_ALGORITHM).to_dict()
public_key = jwk.construct(JWT_PUBLIC_KEY, JWT_ALGORITHM).to_dict()
public_key["kid"] = "cs683-audibooks-key"
public_key["use"] = "sig"

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

pool = connect_with_connector()

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    #token_type: str

class TokenData(BaseModel):
    username: str | None = None
    user_id: str | None = None

# JWT generation and JWT authentication code is adapted from the implementation at
# https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
def get_user(username: str):
    stmt = sqlalchemy.text("SELECT * FROM Users WHERE username=:username",)
    with pool.connect() as conn:
        res = conn.execute(stmt, parameters={"username": username}).fetchone()
    return res._mapping if res is not None else res

def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user:
        return False
    if not pwd_context.verify(password, user.password_hash):
        return False
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, private_key, algorithm=JWT_ALGORITHM, headers={"kid": "cs683-audiobooks-key"})
    return encoded_jwt

# Google Cloud Storage bucket download utility method
def download_blob(source_blob_name):
    storage_client = storage.Client()

    bucket = storage_client.bucket(BUCKET_NAME)

    blob = bucket.blob(source_blob_name)
    contents = blob.download_as_string()
    return contents

def split_text(file, lines_per_part=10):
    parts = []
    curr_count = 0
    curr_char_count = 0
    curr_lines = ''
    for line in file.splitlines(keepends=True):
        line = line.decode('utf-8')

        if curr_count < lines_per_part:
            curr_lines += line
            curr_count += 1
            curr_char_count += len(line)
        elif curr_count == lines_per_part:
            if line.strip() != '':
                curr_lines += line
            else:
                parts.append(curr_lines)
                curr_lines = ''
                curr_lines += line
                curr_count = 1
                curr_char_count = len(line)
    if len(curr_lines) > 0:
        parts.append(curr_lines)
    return parts

def get_tts_audio(text, tts_settings):
    voice_mapping = {
#        'Voice A': 'en-US-Neural2-C',
#        'Voice B': 'en-US-Neural2-D'
        'Voice A': 'en-US-Wavenet-G',
        'Voice B': 'en-US-Wavenet-B'
    }
    
    client = texttospeech.TextToSpeechClient()
    synthesis_input = texttospeech.SynthesisInput(text=text)

    voice = texttospeech.VoiceSelectionParams(language_code="en-US", name=voice_mapping[tts_settings['voice']])

    # Select the type of audio file you want returned
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=tts_settings['speed'], pitch=tts_settings['pitch']
    )
    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )
    return base64.b64encode(response.audio_content).decode('ascii')

@app.get("/get_user")
async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, public_key, audience='api-dot-cs683-audiobooks.appspot.com')
        #username: str = payload.get("sub")
        username: str = payload.get("user")['username']
        user_id: str = payload.get("user")['user_id']
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username, user_id=user_id)
    except JWTError:
        raise credentials_exception
    user = get_user(token_data.username)
    if user is None:
        raise credentials_exception
    return user


@app.post("/token", response_model=Token)
async def login_for_access_token(
#    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
    form_data: UserLogin
):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    now = int(time.time())
    access_token = create_access_token(
        data= 
            {   
                "user": {
                    "username": user.username,
                    "user_id": user.user_id,
                    "is_admin": user.is_admin,
                },
                "iss": "cs683-audiobooks",
                "sub": user.username,
                "aud": "api-dot-cs683-audiobooks.appspot.com",
                "iat": now
            },
            expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

#async def get_user_endpoint(token: Annotated[str, Depends(oauth2_scheme)]):
#    return await get_current_user(token)

@app.post("/register")
async def register(form_data: UserRegister):
    print(form_data)
    with pool.connect() as conn:
        stmt = sqlalchemy.text("SELECT * FROM Users WHERE username=:username OR email=:email",)
        res = conn.execute(stmt, parameters={"username": form_data.username, "email": form_data.email}).fetchone()
        if res is not None:
            raise HTTPException(status_code=409, detail="User with given username or email already exists")
        
        pw_hash = pwd_context.hash(form_data.password)
        stmt = sqlalchemy.text("INSERT INTO Users VALUES (DEFAULT, :username, :email, :pw_hash, FALSE)",)
        conn.execute(stmt, parameters={"username": form_data.username, "email": form_data.email, "pw_hash": pw_hash})
        conn.commit()
    #return {"msg": f"Created user {form_data.username}"}
    token = await login_for_access_token(UserLogin(username=form_data.username,password=form_data.password))
    return token

@app.get("/secure_endpoint")
async def login():
    return {"message": "Successfully authenticated",
            "priv": JWT_PRIVATE_KEY,
            "pub": JWT_PUBLIC_KEY}

@app.get("/jwks.json")
async def login():
    return {"keys": [{'alg': 'RS256',
            'kty': 'RSA',
            'n': 'x2PV1D--_xnnu1xTzHHtAAGBFzcqGQk4k5Pl4LbvgQr84TZ50A7RqgawqRXbdDoBgP5_Y_e_9x4iGqGrO6RWjjVZltpp-W-Al-r0exx81jajowCoRYHA48CJew5CfvNBNgiDn1amGQ9HbEbAmJPvCzuJM4zHcaiTtYOuBkpZl8mV4VPCCpdhGhvsg-4h3Z-9Y6I7kvjb9W-41qVYU2wztjwdktvizUnCZi8eA2FxpX1Tea2UyPZiULtqQsNxkbY2-IE3YbAu-8x9Th94_I2zQ_Q4NaUuOoNrA4OUmhnZ2ly2N5aPFI8juIxKWbaPyRMPQTwage7OerR6bWN1Grp3Sw',
            'e': 'AQAB'}]}

@app.get("/get_books")
# sortedBy: popularity or alphabetical
async def get_books(token: Annotated[str, Depends(oauth2_scheme)],
                    sortedBy : str = 'popularity', numBooks : int = 25, page : int = 0,
                    category : int = 0, author : int = 0):
    payload = jwt.decode(token, public_key, audience='api-dot-cs683-audiobooks.appspot.com')
    user_id: str = payload.get("user")['user_id']
    params = {"user_id": user_id}
    stmt = "SELECT Book.*, Author.name AS author_name, \
            CASE WHEN User_Book_Favorited.book_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorited \
            FROM Book \
            JOIN Author ON Book.author_id = Author.author_id \
            LEFT JOIN  User_Book_Favorited ON Book.book_id = User_Book_Favorited.book_id \
            AND User_Book_Favorited.user_id = :user_id "
    if category != 0:
        params['category_id'] = category
        print(
            'here'
        )
        stmt = "SELECT Book.*, Author.name AS author_name, \
                CASE WHEN User_Book_Favorited.book_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorited\
                FROM Book\
                JOIN Author ON Book.author_id = Author.author_id\
                LEFT JOIN User_Book_Favorited ON Book.book_id = User_Book_Favorited.book_id AND User_Book_Favorited.user_id = :user_id\
                JOIN Book_Categories ON Book.book_id = Book_Categories.book_id\
                JOIN Category ON Category.category_id = Book_Categories.category_id\
                WHERE Category.category_id =:category_id "
        if author != 0:
            params['author_id'] = author
            stmt += "AND Book.author_id =:author_id "
    else:        
        if author != 0:
            params['author_id'] = author
            stmt += "WHERE Book.author_id =:author_id "
    if sortedBy == 'popularity':
        stmt += "ORDER BY popularity DESC "
    elif sortedBy == 'alphabetical':
        stmt += "ORDER BY title ASC "
    stmt += f"LIMIT {numBooks} OFFSET {page * numBooks};"
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt,)
        res = conn.execute(stmt, parameters=params).fetchall()
        res = [x._asdict() for x in res]

        total_num_books = conn.execute(sqlalchemy.text('SELECT COUNT(*) FROM Book;')).fetchone()[0]
        print()
    #return {"books": jsonable_encoder(res), "booksPerPage": numBooks, "numPages": 1 + total_num_books//numBooks}
    return {"books": jsonable_encoder(res), "booksInPage": len(res), "numPages": 1 + (total_num_books-1)//numBooks}

@app.get("/get_book")
async def get_book(bookID : int, token: Annotated[str, Depends(oauth2_scheme)]):
    stmt = "SELECT Book.*, Author.name AS author_name FROM Book JOIN Author ON Book.author_id = Author.author_id\
            WHERE book_id=:book_id;"
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt,)
        res = conn.execute(stmt, parameters={"book_id": bookID}).fetchone()
        if res is None:
            raise HTTPException(status_code=400, detail="Book with the given ID not found")
        book_info = res._asdict()
        stmt = "SELECT Category.category_id, Category.name \
                FROM Category \
                JOIN Book_Categories ON Category.category_id = Book_Categories.category_id \
                WHERE Book_Categories.book_id = :book_id;"
        stmt = sqlalchemy.text(stmt,)
        res = conn.execute(stmt, parameters={"book_id": bookID}).fetchall()
    
    book_info['categories'] = [x[1] for x in res]
    return jsonable_encoder(book_info)

@app.get("/get_user_position")
async def get_user_position(bookID : str, token: Annotated[str, Depends(oauth2_scheme)]):
    payload = jwt.decode(token, public_key, audience='api-dot-cs683-audiobooks.appspot.com')
    user_id: str = payload.get("user")['user_id']

    stmt = "SELECT COUNT(*) FROM Book WHERE book_id=:book_id;"
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt,)
        res = conn.execute(stmt, parameters={"book_id": bookID}).fetchone()[0]
        if res == 0:
            raise HTTPException(status_code=400, detail="Book with the given ID not found")
        
        stmt = "SELECT position FROM User_Book_Position WHERE user_id=:user_id AND book_id=:book_id;"
        stmt = sqlalchemy.text(stmt,)
        res = conn.execute(stmt, parameters={"user_id": user_id, "book_id": bookID}).fetchone()
        if res is None:
            position = 0
        else:
            position = res[0]
    
    return {'position': position}


class ChangeUserPosition_Data(BaseModel):
    bookID : str
    position : int

@app.post("/change_user_position")
async def change_user_position(data : ChangeUserPosition_Data, token: Annotated[str, Depends(oauth2_scheme)]):
    payload = jwt.decode(token, public_key, audience='api-dot-cs683-audiobooks.appspot.com')
    user_id: str = payload.get("user")['user_id']
    bookID = data.bookID
    position = data.position

    if position < 0:
        raise HTTPException(status_code=400, detail="Position must be non-negative")


    stmt = "SELECT COUNT(*) FROM Book WHERE book_id=:book_id;"
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt,)
        res = conn.execute(stmt, parameters={"book_id": bookID}).fetchone()[0]
        if res == 0:
            raise HTTPException(status_code=400, detail="Book with the given ID not found")
        print("I am here")
        stmt = sqlalchemy.text("INSERT INTO User_Book_Position VALUES (:user_id, :book_id, :position) ON CONFLICT (user_id, book_id) DO UPDATE SET position=:position;",)
        conn.execute(stmt, parameters={"user_id": user_id, "book_id": bookID, "position": position})
        conn.commit()

    return {'user_id': user_id, 'book_id': bookID, 'position': position}

class Favorite_Data(BaseModel):
    bookID : str
    favorite : bool

@app.post("/favorite")
async def favorite(data : Favorite_Data, token: Annotated[str, Depends(oauth2_scheme)]):
    payload = jwt.decode(token, public_key, audience='api-dot-cs683-audiobooks.appspot.com')
    user_id: str = payload.get("user")['user_id']
    bookID = data.bookID
    favorite = data.favorite
    print(data)
    stmt = "SELECT COUNT(*) FROM Book WHERE book_id=:book_id;"
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt,)
        res = conn.execute(stmt, parameters={"book_id": bookID}).fetchone()[0]
        if res == 0:
            raise HTTPException(status_code=400, detail="Book with the given ID not found")
        if favorite:
            stmt = sqlalchemy.text("INSERT INTO User_Book_Favorited VALUES (:user_id, :book_id) ON CONFLICT (user_id, book_id) DO NOTHING;",)
        else:
            stmt = sqlalchemy.text("DELETE FROM User_Book_Favorited WHERE user_id=:user_id AND book_id=:book_id;",)
        conn.execute(stmt, parameters={"user_id": user_id, "book_id": bookID})
        conn.commit()

    return {'user_id': user_id, 'book_id': bookID, 'favorite': favorite}

@app.get("/get_favorite_books")
async def get_books(token: Annotated[str, Depends(oauth2_scheme)], sortedBy : str = 'alphabetical', numBooks : int = 25, page : int = 0):
    payload = jwt.decode(token, public_key, audience='api-dot-cs683-audiobooks.appspot.com')
    user_id: str = payload.get("user")['user_id']

    stmt = "SELECT Book.*, Author.name AS author_name FROM Book\
            JOIN Author ON Book.author_id = Author.author_id\
            JOIN User_Book_Favorited ON Book.book_id = User_Book_Favorited.book_id\
            WHERE User_Book_Favorited.user_id = :user_id "
    if sortedBy == 'popularity':
        stmt += "ORDER BY popularity DESC "
    elif sortedBy == 'alphabetical':
        stmt += "ORDER BY title ASC "
    stmt += f"LIMIT {numBooks} OFFSET {page * numBooks};"

    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt)
        res = conn.execute(stmt, parameters={"user_id": user_id}).fetchall()
        new_books = []
        for book in res:
            book = book._asdict()
            book['is_favorited'] = True
            new_books.append(book)
        #res = [x._asdict() for x in res]
        res = new_books

        stmt = 'SELECT COUNT(*) FROM Book\
                JOIN User_Book_Favorited ON Book.book_id = User_Book_Favorited.book_id\
                WHERE User_Book_Favorited.user_id = :user_id;'
        total_num_books = conn.execute(sqlalchemy.text(stmt), parameters={"user_id": user_id}).fetchone()[0]
    return {"books": jsonable_encoder(res), "booksInPage": len(res), "numPages": 1 + total_num_books//numBooks}

@app.get("/get_audio_preference")
async def get_audio_preference(token: Annotated[str, Depends(oauth2_scheme)]):
    payload = jwt.decode(token, public_key, audience='api-dot-cs683-audiobooks.appspot.com')
    user_id: str = payload.get("user")['user_id']

    stmt = "SELECT * FROM User_TTS_Settings WHERE user_id = :user_id "
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt)
        res = conn.execute(stmt, parameters={"user_id": user_id}).fetchone()
        if res is None:
            stmt = "INSERT INTO User_TTS_Settings VALUES (:user_id, 'Voice A', 1.0, 0.0);"
            stmt = sqlalchemy.text(stmt)
            res = conn.execute(stmt, parameters={"user_id": user_id})
            conn.commit()
            return {"voice": "Voice A", "speed": 1.0, "pitch": 0.0}
        res = res._asdict()
    return {"voice": res['voice'], "speed": res['speed'], "pitch": res['pitch']}

class AudioPreference_Data(BaseModel):
    voice : str
    speed : float
    pitch : float

@app.post("/set_audio_preference")
async def set_audio_preference(data : AudioPreference_Data, token: Annotated[str, Depends(oauth2_scheme)]):
    payload = jwt.decode(token, public_key, audience='api-dot-cs683-audiobooks.appspot.com')
    user_id: str = payload.get("user")['user_id']

    if data.voice not in ['Voice A', 'Voice B']:
        raise HTTPException(status_code=400, detail="Invalid voice type")
    elif not (0.25 <= data.speed and data.speed <= 4.0):
        raise HTTPException(status_code=400, detail="Invalid speed, must be between 0.25 and 4.0")
    elif not (-20.0 <= data.pitch and data.pitch <= 20.0):
        raise HTTPException(status_code=400, detail="Invalid pitch, must be between -20.0 and 20.0")

    stmt = "UPDATE User_TTS_Settings SET voice=:voice, speed=:speed, pitch=:pitch WHERE user_id=:user_id;"
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt,)
        conn.execute(stmt, parameters={"user_id": user_id, "voice": data.voice,
                                       "speed": data.speed, "pitch": data.pitch})
        conn.commit()

    return {"voice": data.voice, "speed": data.speed, "pitch": data.pitch}

@app.get("/get_book_file")
async def get_book_file(bookID : int, token: Annotated[str, Depends(oauth2_scheme)]):
    stmt = "SELECT blob_name FROM Book WHERE book_id=:book_id;"
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt,)
        res = conn.execute(stmt, parameters={"book_id": bookID}).fetchone()
        if res is None:
            raise HTTPException(status_code=400, detail="Book with the given ID not found")
    if res[0] not in book_cache:
        file = download_blob('books/books_header_stripped/'+res[0])
        file = split_text(file)
        book_cache[res[0]] = file
    return {"book_file": book_cache[res[0]]}

@app.get("/get_book_audio")
async def get_book_audio(bookID : int, bookPart : int, token: Annotated[str, Depends(oauth2_scheme)]):
    stmt = "SELECT blob_name FROM Book WHERE book_id=:book_id;"
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt,)
        res = conn.execute(stmt, parameters={"book_id": bookID}).fetchone()
        if res is None:
            raise HTTPException(status_code=400, detail="Book with the given ID not found")
    if res[0] not in book_cache:
        file = download_blob('books/books_header_stripped/'+res[0])
        file = split_text(file)
        book_cache[res[0]] = file
    tts_settings = await get_audio_preference(token)
    audio = get_tts_audio(book_cache[res[0]][bookPart], tts_settings)
    
    await change_user_position(ChangeUserPosition_Data(bookID=str(bookID), position=bookPart), token)
    
    return {"audio": audio}

class AddBook_Data(BaseModel):
    title : str
    author_name : str
    publish_date : str
    categories : str
    content : str

@app.post("/add_book")
async def add_book(data : AddBook_Data, token: Annotated[str, Depends(oauth2_scheme)]):
    payload = jwt.decode(token, public_key, audience='api-dot-cs683-audiobooks.appspot.com')
    is_admin = payload.get("user")['is_admin']
    if not is_admin:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    stmt = "SELECT * FROM Author WHERE name =:author_name;"
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt,)
        res = conn.execute(stmt, parameters={"author_name": data.author_name}).fetchone()
        if res is None:
            print('New author insert')
            stmt = "INSERT INTO Author VALUES (DEFAULT, :author_name) RETURNING author_id;"
            stmt = sqlalchemy.text(stmt,)
            res = conn.execute(stmt, parameters={"author_name": data.author_name}).fetchone()
        author_id = res[0]
        
        stmt = "INSERT INTO Book VALUES (DEFAULT, :title, :author_id, :publish_date, '', 0) RETURNING book_id;"
        stmt = sqlalchemy.text(stmt,)
        book_id = conn.execute(stmt, parameters={"title": data.title, "author_id": author_id, "publish_date": data.publish_date}).fetchone()[0]
        
        stmt = "UPDATE Book SET blob_name = :blob_name WHERE book_id = :book_id;"
        stmt = sqlalchemy.text(stmt,)
        conn.execute(stmt, parameters={"book_id": book_id, "blob_name": f"{book_id}.txt"})

        for category in data.categories.split('|'):
            stmt = "INSERT INTO Category VALUES (DEFAULT, :category_name) RETURNING category_id;"
            stmt = sqlalchemy.text(stmt,)
            category_id = conn.execute(stmt, parameters={"category_name": category}).fetchone()[0]
            
            stmt = "INSERT INTO Book_Categories VALUES (:book_id, :category_id);"
            stmt = sqlalchemy.text(stmt,)
            conn.execute(stmt, parameters={"book_id": book_id, "category_id": category_id})

        storage_client = storage.Client()
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(f"books/books_header_stripped/{book_id}.txt")
        blob.upload_from_string(data.content)
        
        conn.commit()
    
    return {"book_id": book_id}

@app.get("/delete_book")
async def delete_book(bookID : int, token: Annotated[str, Depends(oauth2_scheme)]):
    payload = jwt.decode(token, public_key, audience='api-dot-cs683-audiobooks.appspot.com')
    is_admin = payload.get("user")['is_admin']
    if not is_admin:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    with pool.connect() as conn:
        stmt = "DELETE FROM Book_Categories WHERE book_id=:book_id;"
        stmt = sqlalchemy.text(stmt,)
        conn.execute(stmt, parameters={"book_id": bookID})

        stmt = "DELETE FROM User_Book_Position WHERE book_id=:book_id;"
        stmt = sqlalchemy.text(stmt,)
        conn.execute(stmt, parameters={"book_id": bookID})

        stmt = "DELETE FROM User_Book_Favorited WHERE book_id=:book_id;"
        stmt = sqlalchemy.text(stmt,)
        conn.execute(stmt, parameters={"book_id": bookID})

        stmt = "DELETE FROM User_Book_Listened_On WHERE book_id=:book_id;"
        stmt = sqlalchemy.text(stmt,)
        conn.execute(stmt, parameters={"book_id": bookID})

        stmt = "DELETE FROM Book WHERE book_id=:book_id;"
        stmt = sqlalchemy.text(stmt,)
        conn.execute(stmt, parameters={"book_id": bookID})

        storage_client = storage.Client()

        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(f"books/books_header_stripped/{bookID}.txt")
        blob.delete()

        conn.commit()

    return {"book_id": bookID}


@app.get("/get_categories")
async def get_categories(token: Annotated[str, Depends(oauth2_scheme)]):
    stmt = "SELECT Category.category_id, Category.name, COUNT(Book_Categories.book_id) AS count \
            FROM Category \
            LEFT JOIN Book_Categories ON Category.category_id = Book_Categories.category_id \
            GROUP BY Category.category_id, Category.name \
            ORDER BY Category.name ASC;"
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt)
        res = conn.execute(stmt).fetchall()
    res = [x._asdict() for x in res]
    return {"categories": res}

@app.get("/get_authors")
async def get_authors(token: Annotated[str, Depends(oauth2_scheme)]):
    stmt = "SELECT Author.author_id, Author.name, COUNT(Book.book_id) AS count \
            FROM Author \
            LEFT JOIN Book ON Author.author_id = Book.author_id \
            GROUP BY Author.author_id, Author.name \
            ORDER BY Author.name ASC;"
    with pool.connect() as conn:
        stmt = sqlalchemy.text(stmt)
        res = conn.execute(stmt).fetchall()
    res = [x._asdict() for x in res]
    return {"authors": res}