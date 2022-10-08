# @nazaire/resolve-with

Chain related promises together in a **fully typed** graph-like structure. Works quite nicely with [DataLoader](https://www.npmjs.com/package/dataloader>)

```
 let getBookById: (
  id: string
) => Promise<{ id: string; title: string; authorId: string }>;
let getTagsForBook: (
  bookId: string
) => Promise<{ bookId: string; name: string }[]>;
let getAuthorById: (
  id: string
) => Promise<{ id: string; name: string; favouriteBookId: string }>;
let getRelatedBooks: (
  id: string
) => Promise<{ id: string; title: string; authorId: string }[]>;

const bookQuery = (bookId: string) => {
  return resolveWith(getBookById(bookId), {
    // 1. new promise using result
    author: (book) => getAuthorById(book.authorId),
    // 2. parallel promises just for convenience
    tags: getTagsForBook(bookId),
    // 3. complex nested relations
    relatedBooks: resolveManyWith(
      getRelatedBooks(bookId),
      (relatedBook) => ({
        author: resolveWith(getAuthorById(relatedBook.id), {
          favouriteBook: (author) => getBookById(author.favouriteBookId),
        }),
      })
    ),
  });
};

const book = await bookQuery("123");

book.value.title; // string
book.author.name; // string
book.tags[0].name; // string
book.relatedBooks[0].value.title; // string
book.relatedBooks[0].author.value.name; // string;
book.relatedBooks[0].author.favouriteBook.title; // string;
```
