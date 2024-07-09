
# need python, java, npm [node.js, electron]
FROM python
COPY . /pygap/
WORKDIR /pygap

RUN python3 -m pip install --upgrade pip
RUN python3 -m pip install numpy scipy torch transformers dictances spacy nltk sklearn setuptools tqdm word2vec zmq
# numpy: C-based matrix math lib
# scipy: C-based sparse/dense matrix math lib
# torch (PyTorch): machine learning mods
# transformers: tensor-based mods with recent ML/AI tech
# dictances: word distances
# spacy: natural language processing lib
# nltk: natural language toolkit
# sklearn (Sci-kit Learn): ML library
# setuptools: build CPython modules
# tqdm: command-line progress display
# word2vec: word vector embedding
# zmq (ZeroMQ): inter-process communication

FROM openjdk16
##############

FROM node
RUN npm init
RUN npm install --save-dev electron


# disable when this cmd moved inside Electron.
RUN python3 messenger.py

CMD ["npm", "start"]
