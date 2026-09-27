---
id: system-design.non-functional.state-representation
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - api
   - ai
---

We will use mathematics-style symbols to express state in time. The symbol we will use here are:

- $I =$ [[information|Information]]
- $PI =$ [[information|Private Information]]
- $CI =$ [[information|Common Information]]
- $@now =$ [[present-state|present state]]
- $@t / @{timestamp} =$ [[historic-state|Historic State]]
- $i =$ [[essential-and-ideal-state|Essential & Ideal State]]
- $a =$ [[actual-state|Actual State]]

Putting these symbols together we can express various states and sources:

| Scenario                                                                                                                                      | Representation      |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Information state right now                                                                                                                   | $I@now$ OR just $I$ |
| Private Information used for investment advice <br>**Hint:** the word “used” implies past and the fact that it was used meaning actual state. | $aPI@t$             |
| Essential and ideal state of common information available to research how actively cancer research trials are ongoing with help of AI         | $iCI@now$           |
