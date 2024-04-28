const natural = require('natural');
const stopwords = require('stopword');

function createIndex(content) {
    // Tokenize the content into individual words
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(content);

    // Remove stopwords from the tokens
    const filteredTokens = stopwords.removeStopwords(tokens);

    // Create an index object to store the frequency of each word
    const index = {};

    // Count the frequency of each word
    filteredTokens.forEach((token) => {
        if (index[token]) {
            index[token]++;
        } else {
            index[token] = 1;
        }
    });

    return index;
}

function createNGrams(content, n) {
    // Tokenize the content into individual words
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(content);

    // Remove stopwords from the tokens
    const filteredTokens = stopwords.removeStopwords(tokens);

    // Create an array to store the n-grams
    const ngrams = [];

    // Generate n-grams
    for (let i = 0; i <= filteredTokens.length - n; i++) {
        const ngram = filteredTokens.slice(i, i + n).join(' ');
        ngrams.push(ngram);
    }

    return ngrams;
}

const htmlContent = `
===========================================================

     NOTE:  This file combines the first two Project Gutenberg
     files, both of which were given the filenumber #1. There are
     several duplicate files here. There were many updates over
     the years.  All of the original files are included in the
     "old" subdirectory which may be accessed under the "More
     Files" listing in the PG Catalog of this file. No changes
     have been made in these original etexts.

===========================================================


**Welcome To The World of Free Plain Vanilla Electronic Texts**

**Etexts Readable By Both Humans and By Computers, Since 1971**

*These Etexts Prepared By Hundreds of Volunteers and Donations*

Below you will find the first nine Project Gutenberg Etexts, in
one file, with one header for the entire file.  This is to keep
the overhead down, and in response to requests from Gopher site
keeper to eliminate as much of the headers as possible.

However, for legal and financial reasons, we must request these
headers be left at the beginning of each file that is posted in
any general user areas, as Project Gutenberg is run mostly by a
donation from people like you.

If you see our books posted ANYWHERE without these headers, you
are requested to send them a note requesting they re-attach the
header, otherwise they have no legal protection and we have the
loss of the donations we hope will keep Project Gutenberg going
long enough to post 10,000 books, plays, musical pieces, etc.



***START**THE SMALL PRINT!**FOR PUBLIC DOMAIN ETEXTS**START***
Why is this "Small Print!" statement here?  You know: lawyers.
They tell us you might sue us if there is something wrong with
your copy of this etext, even if you got it for free from
someone other than us, and even if what's wrong is not our
fault.  So, among other things, this "Small Print!" statement
disclaims most of our liability to you.  It also tells you how
you can distribute copies of this etext if you want to.

*BEFORE!* YOU USE OR READ THIS ETEXT
By using or reading any part of this PROJECT GUTENBERG-tm
etext, you indicate that you understand, agree to and accept
this "Small Print!" statement.  If you do not, you can receive
a refund of the money (if any) you paid for this etext by
sending a request within 30 days of receiving it to the person
you got it from.  If you received this etext on a physical
medium (such as a disk), you must return it with your request.

ABOUT PROJECT GUTENBERG-TM ETEXTS
This PROJECT GUTENBERG-tm etext, like most PROJECT GUTENBERG-
tm etexts, is a "public domain" work distributed by Professor
Michael S. Hart through the Project Gutenberg Association at
Illinois Benedictine College (the "Project").  Among other
things, this means that no one owns a United States copyright
on or for this work, so the Project (and you!) can copy and
distribute it in the United States without permission and
without paying copyright royalties.  Special rules, set forth
below, apply if you wish to copy and distribute this etext
under the Project's "PROJECT GUTENBERG" trademark.

To create these etexts, the Project expends considerable
efforts to identify, transcribe and proofread public domain
works.  Despite these efforts, the Project's etexts and any
medium they may be on may contain "Defects".  Among other
things, Defects may take the form of incomplete, inaccurate or
corrupt data, transcription errors, a copyright or other
intellectual property infringement, a defective or damaged
disk or other etext medium, a computer virus, or computer
codes that damage or cannot be read by your equipment.

`;

// const index = createIndex(htmlContent);
// console.log(index);

const ngrams = createNGrams(htmlContent, 3);
console.log(ngrams);
