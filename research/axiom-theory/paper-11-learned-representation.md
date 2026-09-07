# One geometry, learned

*Paper 11 of the axiom series: the representation of a person learned from every axis at once, the distilled layer that is the only readable thing about it, the value of each axis measured by what its removal costs, and the loop in which the model chooses the data it learns from.*

**Status: theory research.** Nothing here describes the app or proposes a change to it; `research/README.md` says what a paper is and how one reaches the product. Paper 0 supplies the joint model this paper exceeds and the distilled layer it keeps; paper 0a the policy the representation feeds and the uniform stream it is judged on; G3 the classical floor and the admission test; G2 the version ledger and the custody a trained model lives under; G4 the value ledger this paper is the instrument for; paper 9 the stereotype component every prediction here must be measured against.

**Perfect-form test.** If the app did not exist, this would still be worth saying because a population measured by many sources has a structure no single-source model expresses and no factor model holds — sequential, contextual, nonlinear, and running across sources — and above some volume a model trained to predict each unit's next observation from its whole record learns that structure and cannot say what it learned; so the questions worth stating are what such a representation makes knowable that the readable models do not, how its unreadability is made safe rather than tolerated, what it is worth axis by axis, and what happens when the model that learns from the observations is also the model that chooses them.

**Abstract.** Paper 0 built the joint model of a person as a factor structure over every axis and said, in one paragraph, that above a volume of data the fully populated system exceeds, a learned model would find structure that class cannot express and would be unreadable, so a distilled factor layer is kept beside it with its faithfulness reported. This paper is that paragraph at full length. The learned representation is where the axes actually meet: it is the one place a reading on any axis is predicted from all the others, so cross-axis transfer — the bank predicting the body, the body predicting a test day, ties predicting an answer — is its native product, and the asymmetry of that transfer is the map of which axes carry which. It is the instrument on which the value of an axis is measured, as the loss in predictive code length on the non-adaptive stream when that axis is removed, relative to the portfolio and averaged over orders, which is the number G4's method runs on and which nothing readable supplies. It is what makes the cost of placing a new person fall — the count of observations to a fixed posterior precision, which is paper 0's currency, becomes a curve this paper bends. And it is the input to the policy that chooses observations, which closes a loop: the model learns from data a model chose. Four things make the representation safe rather than merely powerful, and each is a condition. The classical floor runs permanently and the learned model keeps its place only by beating it, per estimand, on the uniform stream, continuously. The distilled layer's faithfulness is an expected log-ratio under named distributions, shifted ones included, and licenses substitution for prediction on those distributions and nothing else — never a reading of its factors as the teacher's structure. Every prediction is measured for how much of it is the anchors, because a model that predicts a person from their categories has learned paper 9's stereotype and will be read as having learned the person. And the representation is a release: it memorizes, it is the most compressed identifying object the system holds, it is trained under custody as a multiparty computation, and every version of it has a row. What a new axis does to an old representation, and whether the volume at which the learned model earns its place has been reached at all, are measurements this paper specifies rather than assumptions it makes.

**1 · The problem, stated structurally**

Every axis in this series has a model of its own, and paper 0 joined them into one: a factor structure over every source, with each axis a measurement model on a shared latent, so that a person is one point in one geometry. That model is readable, its couplings are estimands with identification, and it is the floor everything else stands on.

It is also a class, and a class has things it cannot say. A factor structure expresses covariance. It does not express that what a person answered yesterday changes what they answer today in a way that depends on what was revealed between; that a body reading matters for a test on one day and not another; that the order of two events carries information the events do not; that a tie forming changes how an answer should be read afterwards. Those are sequential, contextual and nonlinear, they run across axes, and paper 0 said in one paragraph that above some volume a model trained to predict each person's next event from their entire record learns them and cannot be read.

This paper is that paragraph made into an axis paper. Its subject is not whether such a model exists — G3 states that as a proposition with a measurement attached — but what it makes knowable across the axes that nothing readable does, what it costs, and how it is kept honest.

**2 · The two objects, and where each stops**

*The floor is readable and bounded by its class.* The strongest classical model the mechanism can fit — paper 0's joint model with every bias term G3 gives it — expresses covariance at every level with a time on each, and is auditable line by line. Its ceiling is its class: whatever the population's structure has that is not covariance is invisible to it, and no amount of data changes that.

*The teacher is unbounded by class and unreadable.* A model trained to predict each person's next observation from their whole record, with the fixed columns as context and reveals, occasion reports and tie changes as events, learns whatever predicts. Its internal state is the richest representation of a person the system can hold. Its ceiling is that nothing in it is a claim: it has no couplings, no estimands, no identification, and a person's representation is a vector whose coordinates mean nothing that can be stated. Alone it is a predictor, and a predictor that has learned the serving policy, the missingness and the categories as readily as the person.

*The distilled layer is the interface, and it is a licence, not a reading.* A factor layer fitted to the teacher's representation in named dimensions, with its faithfulness reported as the expected log-ratio of the teacher's predictive distribution to the surrogate's under a distribution fixed in advance. G3 states what that number is: a bound on the extra code length substitution costs on that distribution, and therefore a licence to use the surrogate there. It is not a statement that the surrogate's factors are the teacher's structure, because two models can agree on every prediction and disagree entirely about why, and the paper claims no such reading anywhere.

*Each stops where the other begins.* The floor says what is claimed; the teacher says what is predictable; the layer says where one may stand in for the other. None of the three is the joint model of a person on its own.

**3 · Five structural facts**

*3.1 The representation is where the axes meet, so transfer is its native product.* A reading on any axis, predicted from every other axis a person has supplied, is what the teacher computes by construction. That is the crossing this series exists to draw — what one answer says about another, across sources — and it is asymmetric: some axes predict others far better than they are predicted by them, and the matrix of those asymmetries is a map of which sources carry which. The map is a property of the population, it is measured on the non-adaptive stream, and it is the first thing this paper makes knowable that paper 0's model does not, because a factor model's transfer is symmetric by its covariance and the teacher's is not.

*3.2 The value of an axis is what its removal costs, and this is the instrument G4 needs.* G1 defines a source's value as the predictive information it adds relative to the portfolio on the stream the policy never chose. The teacher makes that a computation: retrain without the axis, measure the loss in code length on the uniform stream, per target — population couplings, person placement, within-person dynamics. Two things the naive version gets wrong are stated. The loss is marginal to the portfolio, so an axis redundant with another shows little loss however informative it is, and the principled quantity is the loss averaged over the orders in which axes could have been added — which for a dozen axes is thousands of retrainings and is approximated by sampled orders, with the approximation's error stated. And the loss is measured on the uniform stream only, because on the adaptive stream the policy chose observations using the axis, and removing it changes the data as well as the model.

*3.3 The currency bends: placement cost is a curve.* Paper 0's cycle closes in a number — the observations required to place a newly arrived person to a fixed posterior precision — and states that it falls as the population prior sharpens. The teacher is where that fall is realized: a person's first few observations, read against a representation learned from everyone, place them further than the same observations read against a factor prior. The placement-cost curve — precision against observation count, for the floor and for the teacher, on new people held out — is a measured object, and the gap between the two curves is what the learned model is worth to a newcomer.

*3.4 The loop: the model learns from data the model chose.* Paper 0a's policy chooses each observation by expected information under the current model; the teacher is the current model at its strongest; so the observations the teacher learns from next were chosen by the teacher. Three consequences, each already a constraint elsewhere in the series and each binding hardest here. The teacher learns the policy unless the serving propensity is entered, since a missingness pattern generated by an information-seeking rule is structure a predictor will happily fit. The teacher's evaluation is only ever on the uniform stream, since on the adaptive stream it grades data it selected. And a structure the teacher proposes — a residual cluster, a factor the distilled layer names — is a candidate under G3's five-clause admission test and nothing more, because a loop that chooses its data manufactures factors from its choices, and the admission test with its published failure rate is the only thing standing between that and an axis nobody measured.

*3.5 The representation is a release, and it memorizes.* A learned representation of a person is the most compressed identifying object the system holds, and a trained model carries its training data in recoverable form to a degree that is measured, not assumed. So three things follow from G2. The model is trained under custody, as the canonical multiparty computation — the raw columns stay where their custodians hold them and the model is what leaves. Every version of the model has a row in the publication ledger, because a shipped model is a release. And a per-person representation handed to anything is a release of that person, spent against the output-privacy budget, with membership and reconstruction as its named attacks.

**4 · What becomes knowable**

*4.1 The transfer map.* For every ordered pair of axes, how well one predicts the other on the uniform stream, net of the anchors — the matrix of 3.1. It says which axes are upstream of which in predictive terms, which is not a causal reading and is stated as not one, and it says where the series' couplings are strong enough to draw and where they are noise. A row that is nearly empty is an axis nothing predicts, which is either the most valuable axis in the portfolio or the most unreliable, and 4.2 says which.

*4.2 The value ledger.* Per axis, per target, the code-length loss on the uniform stream when it is removed, averaged over sampled orders, with the sampling error stated. This is the number G4's programme runs on. It is portfolio-relative, so it changes as axes are added — which is the path dependence G4 names — and its history is the programme's history.

*4.3 The placement curve.* Precision against observation count for a new person, for the floor and the teacher, and the gap. The gap is the learned model's worth to the one use every person has on their first day, and it is the number a system should quote when it says a representation helps.

*4.4 Structure beyond the class, admitted or not.* Sequential and contextual structure the floor cannot express — the effect of order, of what was revealed between two answers, of the day — appears in the teacher as predictive gain over the floor and in the residuals of the floor as clusters. Each is a candidate. It becomes a finding only under the admission test: it survives on the uniform stream, predicts held-out observations of a different kind than those it was found in, and does not disappear when the serving propensity is entered. A gain over the floor that fails any clause is a gain the loop made.

*4.5 How much of a prediction is the person, and how much is their categories.* A teacher will learn to predict answers from the anchors — age, place, schooling, the declared categories — because they predict, and a prediction that leans on them is paper 9's stereotype component learned by a machine and returned as a reading of the person. So every prediction the teacher makes is decomposed by ablation of the anchors: the part of the code-length gain that survives their removal is the part that is the person's own record. The share is published beside every prediction, and a system that draws a prediction without it is drawing a category and calling it a person.

*4.6 What a new axis does to an old representation.* When an axis is added, the teacher retrained on the new portfolio is a different model with a different geometry, and the persons placed under the old one are not placed under the new one. The pairing ledger of paper 0 says who has supplied the new axis and who has not; the representation must carry a person with a missing axis without pretending it is a person with a zero on it; and the transfer map and the value ledger are recomputed, since every entry is portfolio-relative. Whether the old representation's coordinates survive the addition, or whether the geometry rotates, is a measurement per addition and a property of how coupled the new axis was.

*4.7 Shift, and the floor as its detector.* A learned model's failure under distribution shift — a new country, a new cohort, a changed serving policy — shows first as the floor closing the gap, because the floor's class is smaller and its errors move less. So the gap between teacher and floor on the uniform stream, tracked over time and per cohort, is the shift detector, and a gap that closes is read before any reading the teacher makes is trusted on the shifted population.

*4.8 The volume, measured.* Paper 0 says the fully populated system exceeds the volume at which the learned model earns its place, and G3 says whether it has been reached is a measurement per estimand and per axis of growth. This paper specifies it: the teacher's code-length advantage over the floor on the uniform stream, as a function of population size and of observations per person, per target — a curve that says at what volume the learned model is worth running for what, and below which it is not.

**5 · The return path, and the ranking**

*Every axis.* Each gains its row in the transfer map and its line in the value ledger, which is a number no axis paper in this series could compute for itself.

*The bank.* Its items gain a third classification beside paper 1's tilt and paper 10's relations: their predictive weight in a representation learned from everything, net of the anchors.

*The body.* Paper 5's occasion covariate becomes a context the teacher conditions on for every prediction, which is the within-person reading at the grain the model can hold rather than the grain a factor model can.

*The genome.* The representation is a phenotype battery of a new kind — every prediction the teacher makes about a person is a derived trait — and the genetics of derived traits is available under paper 3's conditions, with the reliability of each stated.

*Observers and ties.* The teacher predicts who will predict whom well and who will follow whom; those predictions are candidates for paper 2's and the ties axis's readings and are admitted under the same test.

*The design layer.* The teacher is the policy's input, and paper 0a's floor, log and uniform stream are what keep that from being a loop that confirms itself.

*The programme.* G4's two moves run on 4.2's ledger and 4.7's detector; this paper is the instrument G4 describes.

*Ranked by what they make knowable.* First, the value ledger and the transfer map, because they are the numbers the whole series has needed and no readable model supplies. Second, the anchor share of every prediction, because without it every reading the teacher returns is a stereotype until shown otherwise. Third, the placement curve and the volume curve, which say what the learned model is worth and when. Structure beyond the class is ranked last, not because it is small but because most of what the loop proposes will fail the test, and the paper prices it that way.

**6 · What would have to hold**

*The floor runs permanently, and the teacher keeps its place only by beating it.* The strongest classical model the mechanism can fit, per estimand, on the uniform stream, continuously; a teacher that stops beating it on any estimand is retired for that estimand, and the comparison is code length and never a metric the teacher's builders defined.

*The uniform stream is the only evaluation surface*, at a fixed share of every person's observations, never selected on, never averaged with the adaptive stream.

*The serving propensity enters every training run*, so the teacher learns the person and not the policy that chose what to ask them.

*Faithfulness is an expected log-ratio under distributions named in advance*, shifted and counterfactual ones included, recomputed as the serving distribution moves, and it licenses substitution for prediction on those distributions and nothing else. No factor of the distilled layer is ever read as the teacher's structure, and the paper's readings never depend on such a reading.

*Every prediction carries its anchor share*, and a reading whose gain does not survive the anchors' removal is published as a category reading.

*Every proposed structure passes the admission test or is a candidate*, with the test's failure rate published, because the loop of 3.4 manufactures.

*The value of an axis is marginal, order-averaged and on the uniform stream*, with the sampling error of the order average stated.

*The representation is trained under custody and released under the budget.* Training is a multiparty computation over the custodians of the columns it touches; a per-person representation is a release spent against the output-privacy budget; membership and reconstruction are measured attacks with stated rates; and every model version has a row.

*Shift is detected before a reading is trusted*, by the gap of 4.7 per cohort, and a reading on a cohort where the gap has closed is a reading of the floor.

*A missing axis is missing*, carried as absence and never as a value, with the pairing ledger saying who supplied what.

*The volume is measured, not assumed*, per estimand, and the teacher runs for the estimands where its advantage is positive at the population's actual size.

**7 · The requirements the design generates**

*A uniform stream at a fixed share of every person's observations*, since everything above is measured on it and nothing else.

*The serving log*, with realised probabilities, entered into every training run.

*Retraining capacity for the value ledger* — sampled orders over the axes, per target, on a cadence — which is the paper's largest recurring cost and is priced as one.

*A held-out set of new people* for the placement curve, never used in training.

*Distributions named in advance for faithfulness*, including at least one shifted cohort.

*A multiparty training protocol* with its trust assumptions and leakage stated, as G2 requires of any pairwise computation, since a model trained on every custodian's columns is the largest such computation the system runs.

*Membership and reconstruction measured per version*, with rates published beside the version's row.

*The volume curve run before the teacher is relied on*, per estimand.

None is a reason to want less. Each is what a representation learned from a fully populated system looks like from the inside.

**8 · What would decide it**

*Has the volume been reached, for what?* The teacher against the floor on the uniform stream at the population's actual size, per target, with the curve against size fitted from subsamples. Where the advantage is not positive the teacher is not run for that target, and everything in section 4 that depends on it waits. This precedes every other question.

*Is the transfer map anything?* Its asymmetries on the uniform stream, net of the anchors, against a null in which every axis predicts every other through the anchors alone. A map that is empty after the anchors is a population whose axes are coupled only through categories, which is a finding and closes 4.1.

*Does the value ledger converge over sampled orders?* The order-averaged loss per axis with its sampling error, at a stated number of orders; a ledger whose entries do not stabilize is one whose path dependence is too strong for the average to mean anything, and G4's method then runs on order-specific values with the order stated.

**9 · The potential, priced with each score's own condition**

A ten is a dataset after which a field's standard design changes; a five answers questions the field already had. Every score is conditional on the volume having been reached for the target it concerns.

*The value ledger and the transfer map.* Eight, conditional on the volume and on the ledger converging, because a measured value per source relative to a portfolio is what G4's method needs and what no science of persons has had; four where the ledger does not converge, since order-specific values still order the axes under a stated order.

*The anchor share.* Seven, unconditional on anything but the volume, because it is the single number that separates a learned reading of a person from a learned reading of their kind, and every system that predicts people needs it and few compute it.

*The placement curve.* Six, conditional on the held-out newcomers, because it is the number a system quotes when it says a representation helps and it is usually asserted.

*Structure beyond the class.* Five where the admission test passes anything, and a finding about the loop where it does not — which is worth having either way, since a loop that proposes nothing admissible has said something about itself.

*Custody-preserving training.* Not priced on this scale; it is a condition on everything above and is the subject of the next paper.

The value concentrates in the first two, and both are conditional on a volume the fully populated system is assumed to exceed and this paper insists on measuring.

**10 · Open questions the data would have to answer**

Whether the volume has been reached for any target at all, which precedes everything and is assumed rather than known. Whether the transfer map survives the anchors. Whether the value ledger converges over orders, and how many orders that takes for a dozen axes. How large the anchor share of a typical prediction is, and whether it can be driven down by design or only reported. Whether faithfulness under a named shifted distribution is a number with usable behaviour or one that collapses on the first cohort not in the training set. What a new axis does to an old geometry, and whether persons placed before an addition can be carried across it. How much a trained representation leaks about its training set at population scale, and whether the budget can afford to release any per-person representation at all. And whether the loop of 3.4 can be run for years without the admission test's failure rate rising, which is the question that decides whether a system that chooses its own observations learns or confirms itself.
