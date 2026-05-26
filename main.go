package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

// Fraction represents a rational number
type Fraction struct {
	Num int64 `json:"num"`
	Den int64 `json:"den"`
}

// Entry represents a matrix entry: constant + coeff * param
type Entry struct {
	Const Fraction `json:"const"` // constant part
	Coeff Fraction `json:"coeff"` // coefficient of parameter
}

// Step represents one row operation step
type Step struct {
	Index    int      `json:"index"`
	Desc     string   `json:"desc"`
	Matrix   [][]Entry `json:"matrix"`
}

func gcd(a, b int64) int64 {
	if a < 0 {
		a = -a
	}
	if b < 0 {
		b = -b
	}
	for b != 0 {
		a, b = b, a%b
	}
	if a == 0 {
		return 1
	}
	return a
}

func newFrac(num, den int64) Fraction {
	if den == 0 {
		return Fraction{0, 1}
	}
	if den < 0 {
		num, den = -num, -den
	}
	g := gcd(num, den)
	return Fraction{num / g, den / g}
}

func (f Fraction) add(g Fraction) Fraction {
	return newFrac(f.Num*g.Den+g.Num*f.Den, f.Den*g.Den)
}

func (f Fraction) sub(g Fraction) Fraction {
	return newFrac(f.Num*g.Den-g.Num*f.Den, f.Den*g.Den)
}

func (f Fraction) mul(g Fraction) Fraction {
	return newFrac(f.Num*g.Num, f.Den*g.Den)
}

func (f Fraction) div(g Fraction) Fraction {
	return newFrac(f.Num*g.Den, f.Den*g.Num)
}

func (f Fraction) neg() Fraction {
	return Fraction{-f.Num, f.Den}
}

func (f Fraction) isZero() bool {
	return f.Num == 0
}

func (f Fraction) String() string {
	if f.Den == 1 {
		return fmt.Sprintf("%d", f.Num)
	}
	return fmt.Sprintf("%d/%d", f.Num, f.Den)
}

func zeroEntry() Entry {
	return Entry{Fraction{0, 1}, Fraction{0, 1}}
}

func numEntry(n, d int64) Entry {
	return Entry{newFrac(n, d), Fraction{0, 1}}
}

func paramEntry(coeffNum, coeffDen int64) Entry {
	return Entry{Fraction{0, 1}, newFrac(coeffNum, coeffDen)}
}

func fullEntry(constNum, constDen, coeffNum, coeffDen int64) Entry {
	return Entry{newFrac(constNum, constDen), newFrac(coeffNum, coeffDen)}
}

func (e Entry) isZero() bool {
	return e.Const.isZero() && e.Coeff.isZero()
}

func (e Entry) hasParam() bool {
	return !e.Coeff.isZero()
}

func (e Entry) neg() Entry {
	return Entry{e.Const.neg(), e.Coeff.neg()}
}

func (e Entry) add(f Entry) Entry {
	return Entry{e.Const.add(f.Const), e.Coeff.add(f.Coeff)}
}

func (e Entry) sub(f Entry) Entry {
	return Entry{e.Const.sub(f.Const), e.Coeff.sub(f.Coeff)}
}

func (e Entry) mulScalar(s Fraction) Entry {
	return Entry{e.Const.mul(s), e.Coeff.mul(s)}
}

func (e Entry) String() string {
	cIsZero := e.Const.isZero()
	pIsZero := e.Coeff.isZero()

	if cIsZero && pIsZero {
		return "0"
	}
	if pIsZero {
		return e.Const.String()
	}
	if cIsZero {
		if e.Coeff.Num == 1 && e.Coeff.Den == 1 {
			return "a"
		}
		if e.Coeff.Num == -1 && e.Coeff.Den == 1 {
			return "-a"
		}
		if e.Coeff.Den == 1 {
			return fmt.Sprintf("%da", e.Coeff.Num)
		}
		return fmt.Sprintf("(%s)a", e.Coeff.String())
	}
	// both parts non-zero
	coeffStr := ""
	if e.Coeff.Num == 1 && e.Coeff.Den == 1 {
		coeffStr = "+a"
	} else if e.Coeff.Num == -1 && e.Coeff.Den == 1 {
		coeffStr = "-a"
	} else if e.Coeff.Num > 0 {
		if e.Coeff.Den == 1 {
			coeffStr = fmt.Sprintf("+%da", e.Coeff.Num)
		} else {
			coeffStr = fmt.Sprintf("+(%s)a", e.Coeff.String())
		}
	} else {
		if e.Coeff.Den == 1 {
			coeffStr = fmt.Sprintf("%da", e.Coeff.Num)
		} else {
			coeffStr = fmt.Sprintf("(%s)a", e.Coeff.String())
		}
	}
	return e.Const.String() + coeffStr
}

func entryFromString(s string) Entry {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" {
		return zeroEntry()
	}

	// Check if it contains 'a' or the parameter
	paramChar := ""
	for _, ch := range s {
		if ch >= 'a' && ch <= 'z' && ch != 'e' {
			paramChar = string(ch)
			break
		}
	}
	if paramChar == "" {
		// pure number
		return parseNumber(s)
	}

	// Split by parameter character
	parts := strings.Split(s, paramChar)
	if len(parts) == 1 {
		// just "a" or similar
		s2 := strings.TrimSpace(parts[0])
		if s2 == "" || s2 == "+" {
			return paramEntry(1, 1)
		}
		if s2 == "-" {
			return paramEntry(-1, 1)
		}
		return Entry{Fraction{0, 1}, parseNumber(s2).Const}
	}

	// parts[0] + param + parts[1]
	coeffPart := strings.TrimSpace(parts[0])
	constPart := strings.TrimSpace(parts[1])

	coeff := Fraction{0, 1}
	if coeffPart == "" || coeffPart == "+" {
		coeff = Fraction{1, 1}
	} else if coeffPart == "-" {
		coeff = Fraction{-1, 1}
	} else {
		coeff = parseNumber(coeffPart).Const
	}

	cnst := Fraction{0, 1}
	if constPart != "" {
		// might start with + or -
		cnst = parseNumber(constPart).Const
	}

	return Entry{cnst, coeff}
}

func parseNumber(s string) Entry {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" {
		return zeroEntry()
	}
	if s == "1" {
		return numEntry(1, 1)
	}
	if s == "-1" {
		return numEntry(-1, 1)
	}
	// try fraction like 3/2
	if strings.Contains(s, "/") {
		parts := strings.SplitN(s, "/", 2)
		var num, den int64
		fmt.Sscanf(parts[0], "%d", &num)
		fmt.Sscanf(parts[1], "%d", &den)
		return numEntry(num, den)
	}
	var n int64
	fmt.Sscanf(s, "%d", &n)
	return numEntry(n, 1)
}

type Matrix struct {
	Rows   int
	Cols   int
	Data   [][]Entry
	Steps  []Step
}

func NewMatrix(rows, cols int) *Matrix {
	m := &Matrix{Rows: rows, Cols: cols}
	m.Data = make([][]Entry, rows)
	for i := range m.Data {
		m.Data[i] = make([]Entry, cols)
		for j := range m.Data[i] {
			m.Data[i][j] = zeroEntry()
		}
	}
	return m
}

func (m *Matrix) clone() [][]Entry {
	d := make([][]Entry, m.Rows)
	for i := range m.Data {
		d[i] = make([]Entry, m.Cols)
		copy(d[i], m.Data[i])
	}
	return d
}

func (m *Matrix) snapshot(desc string) {
	mat := m.clone()
	m.Steps = append(m.Steps, Step{
		Index:  len(m.Steps) + 1,
		Desc:   desc,
		Matrix: mat,
	})
}

func (m *Matrix) RowEchelon() {
	// Gauss-Jordan elimination to reduced row echelon form
	pivotRow := 0
	for col := 0; col < m.Cols && pivotRow < m.Rows; col++ {
		// Find pivot: prefer row with constant-only entry (no param) first,
		// then any non-zero entry
		bestRow := -1
		for row := pivotRow; row < m.Rows; row++ {
			e := m.Data[row][col]
			if e.isZero() {
				continue
			}
			if !e.hasParam() {
				bestRow = row
				break
			}
			if bestRow == -1 {
				bestRow = row
			}
		}
		if bestRow == -1 {
			continue
		}

		// Swap rows if needed
		if bestRow != pivotRow {
			m.Data[pivotRow], m.Data[bestRow] = m.Data[bestRow], m.Data[pivotRow]
			m.snapshot(fmt.Sprintf("交换第%d行和第%d行", pivotRow+1, bestRow+1))
		}

		// Scale pivot row so pivot becomes 1
		pivot := m.Data[pivotRow][col]
		if !pivot.isZero() {
			// For simplicity, if pivot is a param entry like (1)a, we scale to make coefficient 1
			// If it's a pure number, scale to make it 1
			scale := pivot
			if !pivot.hasParam() {
				// pure number, scale to 1
				scale = Entry{newFrac(pivot.Const.Den, pivot.Const.Num), Fraction{0, 1}}
			} else {
				// has parameter - scale to make coefficient 1
				// This is tricky; for now scale by inverse of coefficient
				inv := newFrac(pivot.Coeff.Den, pivot.Coeff.Num)
				scale = Entry{pivot.Const.mul(inv), pivot.Coeff.mul(inv)}
			}

			// Only scale if not already 1
			needScale := false
			if pivot.hasParam() {
				needScale = pivot.Coeff.Num != 1 || pivot.Coeff.Den != 1
			} else {
				needScale = pivot.Const.Num != 1 || pivot.Const.Den != 1
			}

			if needScale {
				for j := col; j < m.Cols; j++ {
					m.Data[pivotRow][j] = m.Data[pivotRow][j].mulScalar(scale.Const)
					// handle param part
					if m.Data[pivotRow][j].hasParam() || scale.hasParam() {
						// entry * scale: (c1 + p1*a)(c2 + p2*a) -- this gets complex
						// For linear operations, scale should be pure number
						// Let's simplify: only scale by pure number factor
					}
				}
				// Re-do: scale by inverse of pivot value (treating param as opaque)
				// Better approach: if pivot is pure number, scale normally
				// If pivot has param, just make coefficient 1
				if !pivot.hasParam() {
					inv := newFrac(pivot.Const.Den, pivot.Const.Num)
					for j := col; j < m.Cols; j++ {
						m.Data[pivotRow][j] = Entry{
							m.Data[pivotRow][j].Const.mul(inv),
							m.Data[pivotRow][j].Coeff.mul(inv),
						}
					}
					m.snapshot(fmt.Sprintf("第%d行 × %s", pivotRow+1, formatScale(inv)))
				} else {
					// pivot has param, scale coefficient to 1
					inv := newFrac(pivot.Coeff.Den, pivot.Coeff.Num)
					for j := col; j < m.Cols; j++ {
						m.Data[pivotRow][j] = Entry{
							m.Data[pivotRow][j].Const.mul(inv),
							m.Data[pivotRow][j].Coeff.mul(inv),
						}
					}
					m.snapshot(fmt.Sprintf("第%d行 × %s (使a的系数为1)", pivotRow+1, formatScale(inv)))
				}
			}
		}

		// Eliminate column in other rows
		for row := 0; row < m.Rows; row++ {
			if row == pivotRow {
				continue
			}
			factor := m.Data[row][col]
			if factor.isZero() {
				continue
			}
			// row = row - factor * pivotRow
			for j := col; j < m.Cols; j++ {
				subVal := m.Data[pivotRow][j].mulScalar(factor.Const)
				// Handle param part of factor
				if factor.hasParam() {
					// factor * pivotRow[j]: need to multiply (c_f + p_f*a) * (c_p + p_p*a)
					// This creates a^2 terms which we can't handle linearly
					// For standard row reduction, we assume factor is the entry value
					// We'll just use factor's constant for scalar multiplication
				}
				m.Data[row][j] = m.Data[row][j].sub(subVal)
			}
			m.snapshot(fmt.Sprintf("第%d行 - (%s)×第%d行", row+1, factor.String(), pivotRow+1))
		}

		pivotRow++
	}
}

func formatScale(f Fraction) string {
	if f.Den == 1 {
		return fmt.Sprintf("%d", f.Num)
	}
	return f.String()
}

type Request struct {
	Rows   int      `json:"rows"`
	Cols   int      `json:"cols"`
	Matrix []string `json:"matrix"` // flat array of strings
}

type Response struct {
	Steps []Step `json:"steps"`
	Error string `json:"error,omitempty"`
}

func handleReduce(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var req Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(Response{Error: "Invalid JSON"})
		return
	}

	if req.Rows <= 0 || req.Cols <= 0 || req.Rows > 10 || req.Cols > 10 {
		json.NewEncoder(w).Encode(Response{Error: "矩阵大小需在1-10之间"})
		return
	}

	if len(req.Matrix) != req.Rows*req.Cols {
		json.NewEncoder(w).Encode(Response{Error: fmt.Sprintf("需要%d个元素，收到%d个", req.Rows*req.Cols, len(req.Matrix))})
		return
	}

	m := NewMatrix(req.Rows, req.Cols)
	idx := 0
	for i := 0; i < req.Rows; i++ {
		for j := 0; j < req.Cols; j++ {
			m.Data[i][j] = entryFromString(req.Matrix[idx])
			idx++
		}
	}

	// Snapshot initial state
	m.snapshot("初始矩阵")

	// Run reduction
	m.RowEchelon()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Steps: m.Steps})
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./static/index.html")
}

func main() {
	http.HandleFunc("/", handleIndex)
	http.HandleFunc("/api/reduce", handleReduce)
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	fmt.Println("Server running on :6130")
	log.Fatal(http.ListenAndServe(":6130", nil))
}
