# Champion trends

`/trending` compares the selected source and role on a patch with the immediately preceding patch in
the local Data Dragon catalog. It never substitutes an older patch just because that patch has data.
The default is the newest patch with aggregates for the source. The role filter includes individual
lanes, unknown roles and an overall `ALL` aggregate.

Only champion aggregates and the local patch/champion catalogs are read. Solo queue uses queue 420;
Pro uses the Oracle `pro` aggregates. Regions and tiers are pooled within each source. The table
paginates 50 champions at a time in numeric champion-key order, including champions observed in
either patch. There are no provider calls from this page.

## Rates and missing observations

- Pick rate: champion picks in the selected role divided by stored match opportunities in that patch
  and source. Each queue/region/tier slice contributes its denominator once, regardless of the
  number of champion or role rows.
- Win rate: known wins divided by champion games with a known result in the selected role.
- Delta: current rate minus previous rate, displayed in percentage points. Both samples are shown.
- A missing champion row, absent patch sample, zero denominator or inconsistent aggregate numerator
  produces an unknown rate and a null delta, never an invented zero. A stored zero successes with a
  positive denominator remains an observed zero rate. Missing champion rows have no champion sample;
  the page separately reports each patch's total match sample.

## Trend policy

A rising or falling label requires **at least 50 trials in each patch**, plus **at least five
observed successes and five observed failures in each patch**. Pick-rate trials are match
opportunities; win-rate trials are games with known results. These are deliberately conservative
sample eligibility rules for this feature, not guarantees of representative sampling.

Eligible comparisons use the pooled two-proportion z statistic described by
[NIST's difference of proportions test](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/diffprci.htm):

```
p_current = successes_current / n_current
p_previous = successes_previous / n_previous
p_pool = (successes_current + successes_previous) / (n_current + n_previous)
z = (p_current - p_previous) / sqrt(p_pool * (1 - p_pool) * (1/n_current + 1/n_previous))
```

The threshold is **abs(z) > 1.96**, a nominal two-sided 5% normal-approximation test. Positive
qualifying deltas are rising; negative ones are falling. Other rows retain their observed deltas but
have no trend label, with the missing, small-sample, sparse-outcome or nonsignificant reason shown.
Pick and win rates are tested independently.

These are exploratory signals. The test treats observations as independent and does not correct for
comparing many champions, roles or metrics. Retained games may share players and differ in region,
tier or source coverage between patches; a label does not establish a balance change's causal effect
or predict an individual player's result.
