import os
import sqlalchemy

from db_connect import connect_with_connector

pool = connect_with_connector()

with pool.connect() as conn:
    conn.execute(sqlalchemy.text(
        '''
        DROP TABLE IF EXISTS User_Book_Position, User_Book_Listened_On, User_Book_Favorited,\
              User_TTS_Settings, Book_Categories, Category, Book, Author, Users;
        '''))
    
    conn.execute(sqlalchemy.text(
        '''
        CREATE TABLE Users (
            user_id SERIAL PRIMARY KEY,
            username VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE
        );
        '''))

    conn.execute(sqlalchemy.text(
        '''
        CREATE TABLE Author (
            author_id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL
        );
        '''))

    conn.execute(sqlalchemy.text(
        '''
        CREATE TABLE Book (
            book_id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            author_id INTEGER REFERENCES Author(author_id),
            publish_date DATE,
            blob_name VARCHAR(255),
            popularity INTEGER
        );
        '''))
    
    conn.execute(sqlalchemy.text(
        '''
        CREATE TABLE Category (
            category_id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL
        );
        '''))
    
    conn.execute(sqlalchemy.text(
        '''
        CREATE TABLE Book_Categories (
            book_id INTEGER REFERENCES Book(book_id),
            category_id INTEGER REFERENCES Category(category_id)
        );
        '''))

    conn.execute(sqlalchemy.text(
        '''
        CREATE TABLE User_TTS_Settings (
            user_id INTEGER PRIMARY KEY REFERENCES Users(user_id),
            voice VARCHAR(255),
            speed REAL,
            pitch REAL
        );
        '''))

    conn.execute(sqlalchemy.text(
        '''
        CREATE TABLE User_Book_Favorited (
            user_id INTEGER REFERENCES Users(user_id),
            book_id INTEGER REFERENCES Book(book_id),
            PRIMARY KEY (user_id, book_id)
        );
        '''))
    
    conn.execute(sqlalchemy.text(
        '''
        CREATE TABLE User_Book_Listened_On (
            user_id INTEGER REFERENCES Users(user_id),
            book_id INTEGER REFERENCES Book(book_id),
            listened_on DATE,
            PRIMARY KEY (user_id, book_id)
        );
        '''))

    conn.execute(sqlalchemy.text(
        '''
        CREATE TABLE User_Book_Position (
            user_id INTEGER REFERENCES Users(user_id),
            book_id INTEGER REFERENCES Book(book_id),
            position INTEGER NOT NULL,
            PRIMARY KEY (user_id, book_id)
        );
        '''))
    
    conn.commit()